const { body, param, query } = require("express-validator");
const InstanceCustomDomain = require("../../models/InstanceCustomDomain");
const Company = require("../../models/Company");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const { audit } = require("../../services/audit.service");
const crypto = require("crypto");
const dns = require("dns").promises;
const { getDB } = require("../../config/db");

/**
 * Strip long-lived TLS secret material from outbound payloads. Verification
 * tokens/records are kept because the instance admin needs them to configure
 * DNS, but private keys and the full certificate are never serialized back.
 */
function redactDomain(domain) {
  if (!domain) return domain;
  const doc = { ...domain };
  delete doc.tls_private_key;
  delete doc.tls_certificate;
  return doc;
}

/**
 * Audit a domain lifecycle event.
 */
function auditDomain(req, action, domain, after = {}, before = null) {
  audit({
    company: req.companyId,
    actorType: req.agent ? "agent" : "user",
    actor: req.agent?._id || req.user?._id,
    actorName: req.agent?.name || req.user?.name || "",
    action,
    entityType: "instance_domain",
    entityId: domain?.id || domain?._id || null,
    before,
    after: { ...(after || {}), hostname: domain?.hostname },
    reason: "instance custom domain lifecycle",
    source: "instance/domains",
    req,
  }).catch(() => {});
}

/**
 * Generate a verification token for domain ownership verification
 */
function generateVerificationToken() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Get the expected DNS record for verification
 */
function getVerificationRecord(domain, token, method) {
  if (method === "txt") {
    return `os-ticket-verification=${token}`;
  }
  // CNAME verification: point verification subdomain to platform
  return `${token}.verify.os-ticket.com`;
}

/**
 * Verify domain ownership via DNS
 */
async function verifyDomainOwnership(domain, token, method) {
  try {
    const expectedRecord = getVerificationRecord(domain, token, method);
    
    if (method === "txt") {
      const records = await dns.resolveTxt(`_os-ticket-verify.${domain}`);
      return records.some(record => record.join(" ").includes(expectedRecord));
    } else {
      // CNAME verification
      const records = await dns.resolveCname(`verify.${domain}`);
      return records.includes(`${expectedRecord}.`);
    }
  } catch (err) {
    console.error("DNS verification failed:", err.message);
    return false;
  }
}

/**
 * Check if hostname is globally unique
 */
async function isHostnameUnique(hostname, excludeInstanceId = null) {
  const db = getDB();
  const query = db("instance_domains")
    .where("hostname", hostname.toLowerCase())
    .where("status", "!=", "disabled");
  
  if (excludeInstanceId) {
    query.where("instance_id", "!=", excludeInstanceId);
  }
  
  const existing = await query.first();
  return !existing;
}

/**
 * List custom domains for an instance
 */
async function listDomains(req, res) {
  const { instanceId } = req.params;
  const { status } = req.query;
  
  const domains = await InstanceCustomDomain.find({ instance_id: instanceId })
    .sort({ created_at: "desc" });
  
  let filtered = domains;
  if (status) {
    filtered = domains.filter(d => d.status === status);
  }
  
  res.json({ success: true, domains: filtered.map(redactDomain) });
}

/**
 * Add a custom domain for an instance
 */
async function addDomain(req, res) {
  const { instanceId } = req.params;
  const { hostname, verification_method } = req.body;
  
  // Check if instance admin
  const membership = req.user?.instanceMemberships?.find(
    (item) => String(item.instance) === instanceId && item.status === "active"
  );
  if (String(req.companyId) !== instanceId || !["instance_owner", "instance_admin"].includes(membership?.role)) {
    throw new ApiError(403, "Instance admin membership required");
  }
  
  // Check hostname uniqueness globally
  const isUnique = await isHostnameUnique(hostname);
  if (!isUnique) {
    throw new ApiError(409, "This hostname is already in use by another instance");
  }
  
  const token = generateVerificationToken();
  const method = verification_method || "txt";
  
  const domain = await InstanceCustomDomain.create({
    instance_id: instanceId,
    hostname: hostname.toLowerCase(),
    verification_token: token,
    verification_method: method,
    status: "pending_verification",
  });
  
  // Return the domain with verification instructions
  const verificationRecord = getVerificationRecord(hostname, token, method);

  auditDomain(req, "instance.domain.added", domain, { token_generated: true });

  res.status(201).json({
    success: true,
    domain,
    verification: {
      method,
      record_type: method === "txt" ? "TXT" : "CNAME",
      host: method === "txt" ? `_os-ticket-verify.${hostname}` : `verify.${hostname}`,
      value: verificationRecord,
      instructions: method === "txt" 
        ? `Add a TXT record for _os-ticket-verify.${hostname} with value: ${verificationRecord}`
        : `Add a CNAME record for verify.${hostname} pointing to: ${verificationRecord}`,
    },
  });
}

/**
 * Get a single domain
 */
async function getDomain(req, res) {
  const { instanceId, domainId } = req.params;
  
  const domain = await InstanceCustomDomain.findById(domainId);
  if (!domain || String(domain.instance_id) !== instanceId) {
    throw new ApiError(404, "Domain not found");
  }
  
  res.json({ success: true, domain: redactDomain(domain) });
}

/**
 * Verify domain ownership via DNS
 */
async function verifyDomain(req, res) {
  const { instanceId, domainId } = req.params;
  
  const domain = await InstanceCustomDomain.findById(domainId);
  if (!domain || String(domain.instance_id) !== instanceId) {
    throw new ApiError(404, "Domain not found");
  }
  
  if (domain.status !== "pending_verification") {
    throw new ApiError(400, "Domain is not pending verification");
  }
  
  const verified = await verifyDomainOwnership(domain.hostname, domain.verification_token, domain.verification_method);
  
  if (verified) {
    await InstanceCustomDomain.updateById(domainId, {
      status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: req.user?.id || req.agent?.id,
    });
    auditDomain(req, "instance.domain.verified", domain, { verified: true });
    res.json({ success: true, message: "Domain verified successfully", verified: true });
  } else {
    await InstanceCustomDomain.updateById(domainId, {
      status: "failed",
      failure_reason: "DNS verification failed - record not found",
    });
    auditDomain(req, "instance.domain.verify_failed", domain, { verified: false }, { status: "pending_verification" });
    res.json({ success: false, message: "DNS verification failed", verified: false });
  }
}

/**
 * Activate a verified domain
 */
async function activateDomain(req, res) {
  const { instanceId, domainId } = req.params;
  
  const domain = await InstanceCustomDomain.findById(domainId);
  if (!domain || String(domain.instance_id) !== instanceId) {
    throw new ApiError(404, "Domain not found");
  }
  
  if (domain.status !== "verified") {
    throw new ApiError(400, "Domain must be verified before activation");
  }
  
  // If setting as primary, unset other primary domains
  if (req.body.is_primary) {
    await getDB()("instance_domains")
      .where("instance_id", instanceId)
      .where("is_primary", true)
      .update({ is_primary: false });
  }
  
  await InstanceCustomDomain.updateById(domainId, {
    status: "active",
    is_primary: req.body.is_primary || false,
    activated_at: new Date().toISOString(),
    activated_by: req.user?.id || req.agent?.id,
  });
  auditDomain(req, "instance.domain.activated", domain, { is_primary: req.body.is_primary || false }, { status: "verified" });
  
  res.json({ success: true, message: "Domain activated" });
}

/**
 * Set domain as primary
 */
async function setPrimaryDomain(req, res) {
  const { instanceId, domainId } = req.params;
  
  const domain = await InstanceCustomDomain.findById(domainId);
  if (!domain || String(domain.instance_id) !== instanceId) {
    throw new ApiError(404, "Domain not found");
  }
  
  if (domain.status !== "active") {
    throw new ApiError(400, "Only active domains can be set as primary");
  }
  
  await getDB()("instance_domains")
    .where("instance_id", instanceId)
    .update({ is_primary: false });
  
  await InstanceCustomDomain.updateById(domainId, { is_primary: true });
  
  // Also update the company/instance default domain
  await Company.updateById(instanceId, { domain: domain.hostname });
  auditDomain(req, "instance.domain.set_primary", domain, { is_primary: true }, { is_primary: false });
  
  res.json({ success: true, message: "Primary domain updated" });
}

/**
 * Disable a domain
 */
async function disableDomain(req, res) {
  const { instanceId, domainId } = req.params;
  
  const domain = await InstanceCustomDomain.findById(domainId);
  if (!domain || String(domain.instance_id) !== instanceId) {
    throw new ApiError(404, "Domain not found");
  }
  
  await InstanceCustomDomain.updateById(domainId, {
    status: "disabled",
    disabled_at: new Date().toISOString(),
    disabled_by: req.user?.id || req.agent?.id,
  });
  auditDomain(req, "instance.domain.disabled", domain, {}, { status: "active" });
  
  res.json({ success: true, message: "Domain disabled" });
}

/**
 * Delete a domain
 */
async function deleteDomain(req, res) {
  const { instanceId, domainId } = req.params;
  
  const domain = await InstanceCustomDomain.findById(domainId);
  if (!domain || String(domain.instance_id) !== instanceId) {
    throw new ApiError(404, "Domain not found");
  }
  
  if (domain.is_primary) {
    throw new ApiError(400, "Cannot delete primary domain. Set another domain as primary first.");
  }
  
  await InstanceCustomDomain.findByIdAndDelete(domainId);
  auditDomain(req, "instance.domain.deleted", domain, {}, { status: domain.status });
  
  res.json({ success: true, message: "Domain deleted" });
}

module.exports = {
  listDomains: asyncHandler(listDomains),
  addDomain: asyncHandler(addDomain),
  getDomain: asyncHandler(getDomain),
  verifyDomain: asyncHandler(verifyDomain),
  activateDomain: asyncHandler(activateDomain),
  setPrimaryDomain: asyncHandler(setPrimaryDomain),
  disableDomain: asyncHandler(disableDomain),
  deleteDomain: asyncHandler(deleteDomain),
};
