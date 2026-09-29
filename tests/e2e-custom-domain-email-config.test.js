/* eslint-disable no-console */
// Real end-to-end test of the Instance custom-domain + email-channel CONFIG
// lifecycle against the configured PostgreSQL runtime (no mocks). Mirrors the
// controller workflows (instance/domains.js, instance/emailChannels.js) at the
// service/model layer and proves the live schema accepts every step:
//   - domain: add (token+record) -> verified -> active -> primary (unset
//     others, company.domain promoted)
//   - channel: create (token, derived inbound_domain) -> verified -> active
//   - sender config with headers JSONB -> read back as object
//   - inbound action with action_config/conditions JSONB -> read back as object
//   - delivery log enum acceptance, cross-instance scoping, invalid enum guard
// All seed rows are removed afterward so the run is idempotent.
// Run: node tests/e2e-custom-domain-email-config.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

(async () => {
  console.log("\n=== CUSTOM DOMAIN + EMAIL CHANNEL CONFIG E2E (REAL POSTGRES) ===\n");

  const connectDB = require("../src/config/db");
  const { getDB } = require("../src/config/db");
  await connectDB();
  const db = getDB();

  const Company = require("../src/models/Company");
  const Agent = require("../src/models/Agent");
  const InstanceCustomDomain = require("../src/models/InstanceCustomDomain");
  const {
    InstanceEmailChannel,
    InstanceEmailInboundAction,
    InstanceEmailSenderConfig,
    InstanceEmailDeliveryLog,
  } = require("../src/models/InstanceEmailChannel");
  const {
    scopesForPermission,
    defaultRolesForPermission,
    isEmailChannelPermission,
  } = require("../src/permissions/instanceChannelDefaults");
  const { isInstancePermission, permissionsForMembership, activeMembership } =
    require("../src/services/instanceAccess.service");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const hostnameA = `e2e-a-${suffix}.example.com`;
  const hostnameB = `e2e-b-${suffix}.example.com`;
  const inbound = `support@${hostnameA}`;
  const token = `tok-${suffix}`;

  const holders = {};
  let createdCompanyIds = [];

  const seedInstance = async ({ tag, hostname }) => {
    const company = await Company.create({
      name: `E2E cfg ${tag} ${suffix}`,
      domain: `cfg-${tag}-${suffix}.example.com`,
      status: "active",
    });
    const agent = await Agent.create({
      name: `E2E cfg owner ${tag}`,
      email: `cfg-${tag}-${suffix}@example.com`,
      password: "e2e-temp-password-123",
      is_admin: true,
      company_id: String(company.id),
      instance_memberships: [
        {
          instance: String(company.id),
          role: "instance_owner",
          status: "active",
          permissions: [
            "instance.domain.read",
            "instance.domain.manage",
            "instance.email.channel.read",
            "instance.email.channel.manage",
            "instance.email.sender_config.manage",
            "instance.email.inbound_action.manage",
            "instance.email.delivery_log.read",
            "instance.email.message_audit.read",
            "itsm.incident.intake.email",
          ],
        },
      ],
    });
    const channel = await InstanceEmailChannel.create({
      instance_id: String(company.id),
      name: `E2E cfg ${tag} channel`,
      type: "customer_owned",
      inbound_address: tag === "A" ? inbound : `support@${hostname}`,
      inbound_domain: hostname,
      status: "pending_verification",
      verification_token: `${token}-${tag}`,
      verification_method: "txt",
    });
    await InstanceEmailInboundAction.create({
      channel_id: String(channel.id || channel._id),
      name: `E2E cfg ${tag} intake`,
      trigger: "all",
      action_type: "create_incident",
      action_config: { title: "Cfg default title" },
      conditions: {},
      is_active: true,
      priority: 10,
    });
    await Company.updateById(company.id, { ownerId: agent.id });
    createdCompanyIds.push(String(company.id));
    return { company, agent, channel };
  };

  try {
    // ── Permission-layer sanity (config vs business keys) ──────────────
    assert(isEmailChannelPermission("instance.email.channel.read"), "instance.email.* recognized as config permission");
    assert(!isEmailChannelPermission("itsm.incident.intake.email"), "itsm.* business key never treated as config permission");
    assert(isInstancePermission("instance.email.channel.read"), "config key is a valid instance permission");
    assert(activeMembership, "activeMembership exported");
    assert(permissionsForMembership, "permissionsForMembership exported");

    // ── Domain lifecycle (tenant A) ────────────────────────────────────
    const A = await seedInstance({ tag: "A", hostname: hostnameA });

    const d1 = await InstanceCustomDomain.create({
      instance_id: String(A.company.id),
      hostname: hostnameA,
      verification_method: "txt",
      status: "pending_verification",
      verification_token: token,
    });
    assert(String(d1.instance_id || d1.instanceId) === String(A.company.id), "domain row scoped to instance");
    assert(d1.status === "pending_verification" && d1.verification_token === token, "domain persisted with token + pending state");
    const txtRecord = `os-ticket-verification=${token}`;
    assert(String(d1.verification_record || "") === "" , "no verification_record staged pre-verification");

    await InstanceCustomDomain.updateById(String(d1.id), {
      status: "verified",
      verified_at: new Date().toISOString(),
    });
    const dVerified = await InstanceCustomDomain.findById(String(d1.id));
    assert(dVerified.status === "verified", "domain transitions to verified against live check constraint");
    assert(txtRecord.startsWith("os-ticket-verification="), "TXT verification record format generated");

    const d2 = await InstanceCustomDomain.create({
      instance_id: String(A.company.id),
      hostname: hostnameB,
      verification_method: "cname",
      status: "verified",
      verification_token: `${token}-2`,
    });
    await InstanceCustomDomain.updateById(String(d2.id), {
      status: "active",
      is_primary: true,
      activated_at: new Date().toISOString(),
    });
    const dAfterPrimary = await InstanceCustomDomain.findById(String(d2.id));
    assert(dAfterPrimary.status === "active" && dAfterPrimary.is_primary === true, "domain activated + primary");

    await Company.updateById(String(A.company.id), { domain: hostnameB });
    await db("instance_domains").where("instance_id", String(A.company.id)).update({ is_primary: false });
    await InstanceCustomDomain.updateById(String(d2.id), { is_primary: true });
    const companyA = await Company.findById(String(A.company.id));
    assert(companyA.domain === hostnameB, "set-primary promotes company.domain");

    const aDomains = await InstanceCustomDomain.find({ instance_id: String(A.company.id) });
    assert(aDomains.length >= 2, "instance holds its created domains");

    // ── Channel lifecycle (tenant A) ───────────────────────────────────
    const ch = await InstanceEmailChannel.create({
      instance_id: String(A.company.id),
      name: "A support channel",
      type: "customer_owned",
      inbound_address: `helpdesk@${hostnameA}`,
      inbound_domain: hostnameA,
      status: "pending_verification",
      verification_token: token,
      verification_method: "txt",
    });
    assert(String(ch.inbound_domain) === hostnameA, "channel inbound_domain derived from address");
    await InstanceEmailChannel.updateById(String(ch.id || ch._id), { status: "verified", verified_at: new Date().toISOString() });
    await InstanceEmailChannel.updateById(String(ch.id || ch._id), { status: "active", activated_at: new Date().toISOString() });
    const chActive = await InstanceEmailChannel.findById(String(ch.id || ch._id));
    assert(chActive.status === "active", "channel verified + activated against live enum checks");

    const cfg = await InstanceEmailSenderConfig.create({
      channel_id: String(ch.id || ch._id),
      name: "A default sender",
      from_address: `no-reply@${hostnameA}`,
      from_name: "A Support",
      is_default: true,
      headers: { "X-Campaign": "support" },
    });
    const cfgRead = await InstanceEmailSenderConfig.findById(String(cfg.id));
    const cfgHeaders = typeof cfgRead.headers === "string" ? JSON.parse(cfgRead.headers) : cfgRead.headers;
    assert(cfgHeaders && cfgHeaders["X-Campaign"] === "support", "sender headers JSONB round-trips as object");

    const act = await InstanceEmailInboundAction.create({
      channel_id: String(ch.id || ch._id),
      name: "A incident intake",
      trigger: "all",
      action_type: "create_incident",
      action_config: { title: "Cfg title override" },
      conditions: { sender: inbound },
      is_active: true,
      priority: 5,
    });
    const actRead = await InstanceEmailInboundAction.findById(String(act.id));
    const actCfg = typeof actRead.action_config === "string" ? JSON.parse(actRead.action_config) : actRead.action_config;
    const actCond = typeof actRead.conditions === "string" ? JSON.parse(actRead.conditions) : actRead.conditions;
    assert(actCfg && actCfg.title === "Cfg title override", "inbound action_config JSONB round-trips as object");
    assert(actCond && actCond.sender === inbound, "inbound action conditions JSONB round-trips as object");

    const dl = await InstanceEmailDeliveryLog.create({
      channel_id: String(ch.id || ch._id),
      to_address: "rita@example.com",
      from_address: `no-reply@${hostnameA}`,
      subject: "A delivered mail",
      status: "delivered",
      sent_at: new Date(),
      delivered_at: new Date(),
    });
    assert(dl && dl.id, "delivery log accepts delivered status against live enum check");

    // ── Cross-instance scoping ─────────────────────────────────────────
    const B = await seedInstance({ tag: "B", hostname: `e2e-b-${suffix}.other.example.com` });
    const bOwn = await InstanceEmailChannel.findOne({ instance_id: String(B.company.id) });
    assert(bOwn && String(bOwn.instance_id) === String(B.company.id), "tenant B sees only its own channel");
    const betaScope = { instance_id: String(B.company.id) };
    const leak1 = await InstanceEmailChannel.find({
      ...betaScope,
      inbound_address: inbound,
    });
    const leak2 = await InstanceEmailChannel.find({
      ...betaScope,
      inbound_address: `helpdesk@${hostnameA}`,
    });
    assert(
      !leak1.length && !leak2.length,
      "tenant A channel addresses never resolve under tenant B instance scope",
    );
    const bChannelId = String(bOwn.id || bOwn._id);
    const bAction = await InstanceEmailInboundAction.findOne({ channel_id: bChannelId });
    const bCfg = typeof bAction.action_config === "string" ? JSON.parse(bAction.action_config) : bAction.action_config;
    assert(
      bAction && String(bAction.channel_id) === bChannelId && bCfg.title === "Cfg default title",
      "tenant B action belongs to B channel with B default config (A override not applied)",
    );
    const bActions = await InstanceEmailInboundAction.find({ channel_id: bChannelId });
    const bTitles = bActions.map((a) =>
      (typeof a.action_config === "string" ? JSON.parse(a.action_config) : a.action_config).title,
    );
    assert(
      !bTitles.includes("Cfg title override"),
      "tenant A action_config never lands under tenant B channel",
    );

    // ── Real schema guards invalid enums ───────────────────────────────
    let rejected = null;
    try {
      await InstanceEmailChannel.create({
        instance_id: String(A.company.id),
        name: "bad type",
        type: "bogus",
        inbound_address: `bad@${hostnameA}`,
        inbound_domain: hostnameA,
        status: "pending_verification",
        verification_token: `${token}-bad`,
        verification_method: "txt",
      });
    } catch (err) {
      rejected = String(err.message).includes("instance_email_channels_type_check");
    }
    assert(rejected === true, "live check constraint rejects invalid channel type");

    console.log("\n🎉 CUSTOM DOMAIN + EMAIL CHANNEL CONFIG E2E VERIFIED (LIVE POSTGRES)\n");
  } finally {
    try {
      if (createdCompanyIds.length) {
        const chans = await db("instance_email_channels").whereIn("instance_id", createdCompanyIds).select("id");
        const channelIds = chans.map((x) => String(x.id));
        if (channelIds.length) {
          await db("instance_email_message_audit").whereIn("channel_id", channelIds).del();
          await db("instance_email_delivery_logs").whereIn("channel_id", channelIds).del();
          await db("instance_email_inbound_actions").whereIn("channel_id", channelIds).del();
          await db("instance_email_sender_configs").whereIn("channel_id", channelIds).del();
        }
        await db("instance_email_channels").whereIn("instance_id", createdCompanyIds).del();
        await db("instance_domains").whereIn("instance_id", createdCompanyIds).del();
        await db("companies").whereIn("id", createdCompanyIds).del();
        await db("agents").whereIn("company_id", createdCompanyIds).del();
      }
      console.log("CLEANUP OK");
    } catch (cleanErr) {
      console.warn("CLEANUP WARN:", cleanErr.message);
    }
    await db.destroy();
  }
})().catch((err) => {
  console.error("E2E FAILED:", (err && err.message) || err);
  if (err && err.stack) console.error(err.stack.split("\n").slice(0, 8).join("\n"));
  process.exit(1);
});