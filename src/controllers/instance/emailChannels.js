const { InstanceEmailChannel, InstanceEmailInboundAction, InstanceEmailSenderConfig, InstanceEmailDeliveryLog, InstanceEmailMessageAudit } = require("../../models/InstanceEmailChannel");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const { audit } = require("../../services/audit.service");
const crypto = require("crypto");
const dns = require("dns").promises;
const { getDB } = require("../../config/db");

const SECRET_FIELDS = ["smtp_password", "dkim_private_key", "tls_private_key", "tls_certificate"];

/**
 * Never serialize long-lived secrets. Credential presence is surfaced as flags
 * so the UI can indicate configured vs. unconfigured.
 */
function redactChannel(channel) {
  if (!channel) return channel;
  const doc = { ...channel };
  const flags = {};
  for (const field of SECRET_FIELDS) {
    if (doc[field] != null && doc[field] !== "") {
      flags[`has_${field}`] = true;
    }
    delete doc[field];
  }
  return { ...doc, ...flags };
}

/**
 * Audit an email channel lifecycle event.
 */
function auditChannel(req, action, channel, after = {}, before = null) {
  audit({
    company: req.companyId,
    actorType: req.agent ? "agent" : "user",
    actor: req.agent?._id || req.user?._id,
    actorName: req.agent?.name || req.user?.name || "",
    action,
    entityType: "instance_email_channel",
    entityId: channel?.id || channel?._id || null,
    before,
    after: { ...(after || {}), inbound_address: channel?.inbound_address, name: channel?.name },
    reason: "instance email channel lifecycle",
    source: "instance/email-channels",
    req,
  }).catch(() => {});
}

/**
 * Generate a verification token for email channel ownership verification
 */
function generateVerificationToken() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Get the expected DNS record for verification
 */
function getVerificationRecord(domain, token, method) {
  if (method === "txt") {
    return `os-ticket-email-verify=${token}`;
  }
  return `${token}.verify.os-ticket.com`;
}

/**
 * Verify domain ownership via DNS
 */
async function verifyEmailChannelOwnership(domain, token, method) {
  try {
    const expectedRecord = getVerificationRecord(domain, token, method);
    
    if (method === "txt") {
      const records = await dns.resolveTxt(`_os-ticket-email-verify.${domain}`);
      return records.some(record => record.join(" ").includes(expectedRecord));
    } else {
      const records = await dns.resolveCname(`email-verify.${domain}`);
      return records.includes(`${expectedRecord}.`);
    }
  } catch (err) {
    console.error("DNS verification failed:", err.message);
    return false;
  }
}

/**
 * Check if inbound address is globally unique
 */
async function isInboundAddressUnique(inboundAddress, excludeInstanceId = null) {
  const db = getDB();
  const query = db("instance_email_channels")
    .where("inbound_address", inboundAddress.toLowerCase())
    .where("status", "!=", "disabled");
  
  if (excludeInstanceId) {
    query.where("instance_id", "!=", excludeInstanceId);
  }
  
  const existing = await query.first();
  return !existing;
}

/**
 * List email channels for an instance
 */
async function listChannels(req, res) {
  const { instanceId } = req.params;
  const { status } = req.query;
  
  const channels = await InstanceEmailChannel.find({ instance_id: instanceId })
    .sort({ created_at: "desc" });
  
  let filtered = channels;
  if (status) {
    filtered = channels.filter(c => c.status === status);
  }
  
  res.json({ success: true, channels: filtered.map(redactChannel) });
}

/**
 * Create an email channel for an instance
 */
async function createChannel(req, res) {
  const { instanceId } = req.params;
  const { name, inbound_address, type, verification_method } = req.body;
  
  // Check if instance admin
  const membership = req.user?.instanceMemberships?.find(
    (item) => String(item.instance) === instanceId && item.status === "active"
  );
  if (String(req.companyId) !== instanceId || !["instance_owner", "instance_admin"].includes(membership?.role)) {
    throw new ApiError(403, "Instance admin membership required");
  }
  
  // Check inbound address uniqueness globally
  const isUnique = await isInboundAddressUnique(inbound_address);
  if (!isUnique) {
    throw new ApiError(409, "This inbound email address is already in use by another instance");
  }
  
  const token = generateVerificationToken();
  const method = verification_method || "txt";
  
  const channel = await InstanceEmailChannel.create({
    instance_id: instanceId,
    name,
    inbound_address: inbound_address.toLowerCase(),
    inbound_domain: inbound_address.split("@")[1] || "",
    type: type || "platform_managed",
    verification_token: token,
    verification_method: method,
    status: "pending_verification",
  });
  
  const verificationRecord = getVerificationRecord(channel.inbound_domain, token, method);
  auditChannel(req, "instance.email_channel.created", channel, { token_generated: true });
  
  res.status(201).json({
    success: true,
    channel: redactChannel(channel),
    verification: {
      method,
      record_type: method === "txt" ? "TXT" : "CNAME",
      host: method === "txt" ? `_os-ticket-email-verify.${channel.inbound_domain}` : `email-verify.${channel.inbound_domain}`,
      value: verificationRecord,
      instructions: method === "txt" 
        ? `Add a TXT record for _os-ticket-email-verify.${channel.inbound_domain} with value: ${verificationRecord}`
        : `Add a CNAME record for email-verify.${channel.inbound_domain} pointing to: ${verificationRecord}`,
    },
  });
}

/**
 * Get a single email channel
 */
async function getChannel(req, res) {
  const { instanceId, channelId } = req.params;
  
  const channel = await InstanceEmailChannel.findById(channelId);
  if (!channel || String(channel.instance_id) !== instanceId) {
    throw new ApiError(404, "Email channel not found");
  }
  
  res.json({ success: true, channel: redactChannel(channel) });
}

/**
 * Update email channel (SMTP config, sender config, etc.)
 */
async function updateChannel(req, res) {
  const { instanceId, channelId } = req.params;
  const allowedFields = [
    "name", "smtp_host", "smtp_port", "smtp_secure", "smtp_username", 
    "smtp_password", "from_address", "from_name", "reply_to_address",
    "spf_record", "dkim_private_key", "dkim_selector", "dmarc_record"
  ];
  
  const channel = await InstanceEmailChannel.findById(channelId);
  if (!channel || String(channel.instance_id) !== instanceId) {
    throw new ApiError(404, "Email channel not found");
  }
  
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }
  
  const updated = await InstanceEmailChannel.updateById(channelId, updates);
  auditChannel(req, "instance.email_channel.updated", channel, { updated: Object.keys(updates) }, { ...channel });
  res.json({ success: true, channel: redactChannel(updated) });
}

/**
 * Verify email channel ownership via DNS
 */
async function verifyChannel(req, res) {
  const { instanceId, channelId } = req.params;
  
  const channel = await InstanceEmailChannel.findById(channelId);
  if (!channel || String(channel.instance_id) !== instanceId) {
    throw new ApiError(404, "Email channel not found");
  }
  
  if (channel.status !== "pending_verification") {
    throw new ApiError(400, "Channel is not pending verification");
  }
  
  const verified = await verifyEmailChannelOwnership(channel.inbound_domain, channel.verification_token, channel.verification_method);
  
  if (verified) {
    await InstanceEmailChannel.updateById(channelId, {
      status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: req.user?.id || req.agent?.id,
    });
    auditChannel(req, "instance.email_channel.verified", channel, { verified: true });
    
    res.json({ success: true, message: "Email channel verified successfully", verified: true });
  } else {
    await InstanceEmailChannel.updateById(channelId, {
      status: "failed",
      failure_reason: "DNS verification failed - record not found",
    });
    auditChannel(req, "instance.email_channel.verify_failed", channel, { verified: false }, { status: "pending_verification" });
    
    res.json({ success: false, message: "DNS verification failed", verified: false });
  }
}

/**
 * Activate a verified email channel
 */
async function activateChannel(req, res) {
  const { instanceId, channelId } = req.params;
  
  const channel = await InstanceEmailChannel.findById(channelId);
  if (!channel || String(channel.instance_id) !== instanceId) {
    throw new ApiError(404, "Email channel not found");
  }
  
  if (channel.status !== "verified") {
    throw new ApiError(400, "Channel must be verified before activation");
  }
  
  await InstanceEmailChannel.updateById(channelId, {
    status: "active",
    activated_at: new Date().toISOString(),
    activated_by: req.user?.id || req.agent?.id,
  });
  auditChannel(req, "instance.email_channel.activated", channel, {}, { status: "verified" });
  
  res.json({ success: true, message: "Email channel activated" });
}

/**
 * Disable an email channel
 */
async function disableChannel(req, res) {
  const { instanceId, channelId } = req.params;
  
  const channel = await InstanceEmailChannel.findById(channelId);
  if (!channel || String(channel.instance_id) !== instanceId) {
    throw new ApiError(404, "Email channel not found");
  }
  
  await InstanceEmailChannel.updateById(channelId, {
    status: "disabled",
    disabled_at: new Date().toISOString(),
    disabled_by: req.user?.id || req.agent?.id,
  });
  auditChannel(req, "instance.email_channel.disabled", channel, {}, { status: channel.status });
  
  res.json({ success: true, message: "Email channel disabled" });
}

/**
 * Delete an email channel
 */
async function deleteChannel(req, res) {
  const { instanceId, channelId } = req.params;
  
  const channel = await InstanceEmailChannel.findById(channelId);
  if (!channel || String(channel.instance_id) !== instanceId) {
    throw new ApiError(404, "Email channel not found");
  }
  
  await InstanceEmailChannel.findByIdAndDelete(channelId);
  auditChannel(req, "instance.email_channel.deleted", channel, {}, { status: channel.status });
  
  res.json({ success: true, message: "Email channel deleted" });
}

/**
 * Audit a child entity (inbound action / sender config) lifecycle event.
 */
function auditChild(req, action, entityType, entity, channelId, after = {}, before = null) {
  audit({
    company: req.companyId,
    actorType: req.agent ? "agent" : "user",
    actor: req.agent?._id || req.user?._id,
    actorName: req.agent?.name || req.user?.name || "",
    action,
    entityType,
    entityId: entity?.id || entity?._id || null,
    before,
    after: { ...(after || {}), channel_id: channelId },
    reason: entityType,
    source: "instance/email-channels",
    req,
  }).catch(() => {});
}

/**
 * Assert that a channel belongs to the requesting instance. Every child-entity
 * handler (inbound action, sender config, delivery log, message audit) must
 * satisfy this ownership check before touching its rows, otherwise a channelId
 * from another instance could be referenced through this instance's namespace.
 */
async function assertChannelInInstance(instanceId, channelId) {
  const channel = await InstanceEmailChannel.findById(channelId);
  if (!channel || String(channel.instance_id) !== String(instanceId)) {
    throw new ApiError(404, "Email channel not found");
  }
  return channel;
}

/**
 * Inbound Actions CRUD
 */
async function listInboundActions(req, res) {
  const { instanceId, channelId } = req.params;
  await assertChannelInInstance(instanceId, channelId);
  
  const actions = await InstanceEmailInboundAction.find({ channel_id: channelId })
    .sort({ priority: "asc" });
  
  res.json({ success: true, actions });
}

async function createInboundAction(req, res) {
  const { instanceId, channelId } = req.params;
  const { name, description, trigger, conditions, action_type, action_config, priority } = req.body;
  
  await assertChannelInInstance(instanceId, channelId);
  
  const action = await InstanceEmailInboundAction.create({
    channel_id: channelId,
    name,
    description: description || "",
    trigger: trigger || "all",
    conditions: conditions || {},
    action_type: action_type || "create_incident",
    action_config: action_config || {},
    priority: priority || 100,
  });
  auditChild(req, "instance.email_inbound_action.created", "instance_email_inbound_action", action, channelId, { trigger: action.trigger, action_type: action.action_type });
  
  res.status(201).json({ success: true, action });
}

async function updateInboundAction(req, res) {
  const { instanceId, channelId, actionId } = req.params;
  await assertChannelInInstance(instanceId, channelId);
  
  const action = await InstanceEmailInboundAction.findById(actionId);
  if (!action || String(action.channel_id) !== channelId) {
    throw new ApiError(404, "Inbound action not found");
  }
  
  const allowedFields = ["name", "description", "trigger", "conditions", "action_type", "action_config", "is_active", "priority"];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }
  
  const updated = await InstanceEmailInboundAction.updateById(actionId, updates);
  auditChild(req, "instance.email_inbound_action.updated", "instance_email_inbound_action", action, channelId, { updated: Object.keys(updates) }, { ...action });
  res.json({ success: true, action: updated });
}

async function deleteInboundAction(req, res) {
  const { instanceId, channelId, actionId } = req.params;
  await assertChannelInInstance(instanceId, channelId);
  
  const action = await InstanceEmailInboundAction.findById(actionId);
  if (!action || String(action.channel_id) !== channelId) {
    throw new ApiError(404, "Inbound action not found");
  }
  
  await InstanceEmailInboundAction.findByIdAndDelete(actionId);
  auditChild(req, "instance.email_inbound_action.deleted", "instance_email_inbound_action", action, channelId, {}, { ...action });
  res.json({ success: true, message: "Inbound action deleted" });
}

/**
 * Sender Configs CRUD
 */
async function listSenderConfigs(req, res) {
  const { instanceId, channelId } = req.params;
  await assertChannelInInstance(instanceId, channelId);
  
  const configs = await InstanceEmailSenderConfig.find({ channel_id: channelId })
    .sort({ created_at: "desc" });
  
  res.json({ success: true, configs });
}

async function createSenderConfig(req, res) {
  const { instanceId, channelId } = req.params;
  const { name, from_address, from_name, reply_to_address, is_default, headers } = req.body;
  
  await assertChannelInInstance(instanceId, channelId);
  
  // If setting as default, unset other defaults
  if (is_default) {
    await getDB()("instance_email_sender_configs")
      .where("channel_id", channelId)
      .update({ is_default: false });
  }
  
  const config = await InstanceEmailSenderConfig.create({
    channel_id: channelId,
    name,
    from_address,
    from_name: from_name || "",
    reply_to_address: reply_to_address || "",
    is_default: is_default || false,
    headers: headers || {},
  });
  auditChild(req, "instance.email_sender_config.created", "instance_email_sender_config", config, channelId, { from_address: config.from_address, is_default: config.is_default });
  
  res.status(201).json({ success: true, config });
}

async function updateSenderConfig(req, res) {
  const { instanceId, channelId, configId } = req.params;
  await assertChannelInInstance(instanceId, channelId);
  
  const config = await InstanceEmailSenderConfig.findById(configId);
  if (!config || String(config.channel_id) !== channelId) {
    throw new ApiError(404, "Sender config not found");
  }
  
  const allowedFields = ["name", "from_address", "from_name", "reply_to_address", "is_default", "headers"];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  if (updates.is_default) {
    await getDB()("instance_email_sender_configs")
      .where("channel_id", channelId)
      .update({ is_default: false });
  }
  
  const updated = await InstanceEmailSenderConfig.updateById(configId, updates);
  auditChild(req, "instance.email_sender_config.updated", "instance_email_sender_config", config, channelId, { updated: Object.keys(updates) }, { ...config });
  res.json({ success: true, config: updated });
}

async function deleteSenderConfig(req, res) {
  const { instanceId, channelId, configId } = req.params;
  await assertChannelInInstance(instanceId, channelId);
  
  const config = await InstanceEmailSenderConfig.findById(configId);
  if (!config || String(config.channel_id) !== channelId) {
    throw new ApiError(404, "Sender config not found");
  }
  
  if (config.is_default) {
    throw new ApiError(400, "Cannot delete default sender config. Set another as default first.");
  }
  
  await InstanceEmailSenderConfig.findByIdAndDelete(configId);
  auditChild(req, "instance.email_sender_config.deleted", "instance_email_sender_config", config, channelId, {}, { ...config });
  res.json({ success: true, message: "Sender config deleted" });
}

/**
 * Delivery Logs
 */
async function listDeliveryLogs(req, res) {
  const { instanceId, channelId } = req.params;
  const { status, limit = 50, offset = 0 } = req.query;
  await assertChannelInInstance(instanceId, channelId);
  
  let logs = await InstanceEmailDeliveryLog.find({ channel_id: channelId })
    .sort({ sent_at: "desc" })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

  if (status) {
    logs = logs.filter(l => l.status === status);
  }

  res.json({ success: true, logs });
}

/**
 * Message Audit
 */
async function listMessageAudit(req, res) {
  const { instanceId, channelId } = req.params;
  const { action, limit = 50, offset = 0 } = req.query;
  await assertChannelInInstance(instanceId, channelId);
  
  let audits = await InstanceEmailMessageAudit.find({ channel_id: channelId })
    .sort({ processed_at: "desc" })
    .limit(parseInt(limit))
    .skip(parseInt(offset));
  
  if (action) {
    audits = audits.filter(a => a.action === action);
  }
  
  res.json({ success: true, audits });
}

module.exports = {
  listChannels: asyncHandler(listChannels),
  createChannel: asyncHandler(createChannel),
  getChannel: asyncHandler(getChannel),
  updateChannel: asyncHandler(updateChannel),
  verifyChannel: asyncHandler(verifyChannel),
  activateChannel: asyncHandler(activateChannel),
  disableChannel: asyncHandler(disableChannel),
  deleteChannel: asyncHandler(deleteChannel),
  listInboundActions: asyncHandler(listInboundActions),
  createInboundAction: asyncHandler(createInboundAction),
  updateInboundAction: asyncHandler(updateInboundAction),
  deleteInboundAction: asyncHandler(deleteInboundAction),
  listSenderConfigs: asyncHandler(listSenderConfigs),
  createSenderConfig: asyncHandler(createSenderConfig),
  updateSenderConfig: asyncHandler(updateSenderConfig),
  deleteSenderConfig: asyncHandler(deleteSenderConfig),
  listDeliveryLogs: asyncHandler(listDeliveryLogs),
  listMessageAudit: asyncHandler(listMessageAudit),
};
