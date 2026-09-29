/* eslint-disable no-console */
// Real end-to-end email-driven ITSM intake test against the configured
// PostgreSQL runtime (no mocks, no IMAP). Drives processParsedEmail() the way
// the IMAP poller does and asserts:
//   - ALLOW:  channel+action owner with the target itsm.* grant  -> Incident
//             created, message audit row logged, email marked processed.
//   - DENY:   tenant without the target itsm.* grant              -> email
//             skipped, NO incident, permission_denied audit row.
// All seed rows are removed afterward so the run is idempotent.
// Run: node tests/e2e-email-driven-record.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

(async () => {
  console.log("\n=== EMAIL-DRIVEN ITSM INTAKE E2E (REAL POSTGRES) ===\n");

  const connectDB = require("../src/config/db");
  const { getDB } = require("../src/config/db");
  await connectDB();
  const db = getDB();

  const Company = require("../src/models/Company");
  const Agent = require("../src/models/Agent");
  const Incident = require("../src/models/helpdesk/incidents/Incident");
  const {
    InstanceEmailChannel,
    InstanceEmailInboundAction,
    InstanceEmailMessageAudit,
  } = require("../src/models/InstanceEmailChannel");
  const { processParsedEmail } = require("../src/services/inboundEmail.service");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const domain = `e2e-${suffix}.verify.example.com`;
  const inbound = `support@${domain}`;
  const owner = `owner-${suffix}@verify.example.com`;
  const rita = `rita-${suffix}@acme.example.com`;
  const messageId = `<e2e-${suffix}@verify.example.com>`;
  const denyMessageId = `<e2e-deny-${suffix}@verify.example.com>`;

  const created = [];
  const seed = async ({ grant }) => {
    const company = await Company.create({
      name: `E2E ${suffix} ${grant ? "granted" : "denied"}`,
      domain: `${grant ? "g" : "d"}-${suffix}.verify.example.com`,
      status: "active",
    });
    const user = await Agent.create({
      name: `E2E Owner ${grant ? "G" : "D"}`,
      email: `${grant ? "g" : "d"}-${owner}`,
      password: "e2e-temp-password-123",
      is_admin: true,
      company_id: String(company.id),
      instance_memberships: [
        {
          instance: String(company.id),
          role: "instance_owner",
          status: "active",
          permissions: grant ? ["itsm.incident.intake.email"] : [],
        },
      ],
    });
    await Company.updateById(company.id, { ownerId: user.id });
    const channel = await InstanceEmailChannel.create({
      instance_id: String(company.id),
      name: `E2E ${grant ? "G" : "D"} channel`,
      type: "customer_owned",
      inbound_address: inbound,
      inbound_domain: domain,
      status: "active",
      verification_token: "e2e-verification-token",
      verification_method: "txt",
    });
    const action = await InstanceEmailInboundAction.create({
      channel_id: String(channel.id || channel._id),
      name: `E2E ${grant ? "G" : "D"} intake`,
      trigger: "all",
      action_type: "create_incident",
      action_config: {},
      conditions: {},
      is_active: true,
      priority: 100,
    });
    created.push({ company, user, channel, action });
    return { company, user, channel, action };
  };

  const run = (payload) =>
    processParsedEmail({
      inReplyTo: [],
      references: [],
      senderName: "Rita Reporter",
      attachments: [],
      toAddresses: [inbound],
      ...payload,
    });

  try {
    // ── ALLOW path ────────────────────────────────────────────────────
    const allowed = await seed({ grant: true });
    const allowedResult = await run({
      messageId,
      senderEmail: rita,
      subject: "Checkout API down",
      text: "The checkout API is returning 500s since 09:00.",
      companyId: String(allowed.company.id),
    });
    console.log("ALLOW result:", JSON.stringify(allowedResult));
    assert(
      allowedResult.action === "incident" && !!allowedResult.recordNumber,
      "email-driven Incident created (action=incident)",
    );

    const incident = await Incident.findOne({
      company: String(allowed.company.id),
    }).sort({ createdAt: -1 });
    assert(incident && incident.title === "Checkout API down", "Incident row persisted with subject-derived title");
    const incidentMeta =
      typeof incident.customFields === "string"
        ? JSON.parse(incident.customFields)
        : incident.customFields;
    assert(incidentMeta && incidentMeta.source === "email", "Incident carries email source meta");
    assert(
      String(allowedResult.recordNumber) === String(incident.number),
      "reported record number matches persisted Incident",
    );

    const auditOk = await InstanceEmailMessageAudit.findOne({
      message_id: messageId,
      direction: "inbound",
    });
    console.log("message-audit:", auditOk ? JSON.stringify({ action: auditOk.action, record_type: auditOk.record_type, error_message: auditOk.error_message }) : null);
    assert(auditOk && auditOk.record_type === "incident", "message-audit row written for created Incident");
    assert(auditOk.action === "created_ticket", "message-audit action recorded");

    const auditEventRows = await db("audit_events")
      .where({ tenant_id: String(allowed.company.id), action: "incident.created" })
      .count({ n: "*" });
    assert(
      Number(auditEventRows[0]?.n) >= 1,
      "audit_events row persisted for the created Incident",
    );

    // ── DENY path ─────────────────────────────────────────────────────
    const denied = await seed({ grant: false });
    const deniedResult = await run({
      messageId: denyMessageId,
      senderEmail: `bob-${suffix}@other.example.com`,
      subject: "Unauthorized intake attempt",
      text: "This tenant never granted itsm.incident.intake.email.",
      companyId: String(denied.company.id),
    });
    console.log("DENY result:", JSON.stringify(deniedResult));
    assert(
      deniedResult.action === "skipped" && deniedResult.reason === "email_permission_denied",
      "denied tenant skips email without the target itsm.* grant",
    );
    const deniedIncident = await Incident.findOne({ company: String(denied.company.id) });
    assert(!deniedIncident, "no Incident created on denied intake");
    const auditDeny = await InstanceEmailMessageAudit.findOne({ message_id: denyMessageId });
    assert(
      auditDeny && String(auditDeny.error_message).startsWith("permission_denied:"),
      "permission_denied audit row persisted",
    );

    console.log("\n🎉 E2E EMAIL-DRIVEN ITSM INTAKE VERIFIED (LIVE POSTGRES)\n");
  } finally {
    // ── Cleanup (FK-safe order) ───────────────────────────────────────
    try {
      const companyIds = created.map((c) => String(c.company.id));
      const channelIds = created.map((c) => String(c.channel.id || c.channel._id));
      for (const m of [messageId, denyMessageId]) {
        await db("instance_email_message_audit").where("message_id", m).del();
        await db("email_logs").whereRaw("meta::jsonb @> ?::jsonb", JSON.stringify([{ messageId: m }])).del();
      }
      if (companyIds.length) {
        await db("incident_assignment_histories")
          .whereIn("incident_id", db("incidents").select("id").whereIn("company_id", companyIds))
          .del();
        await db("audit_events").whereIn("tenant_id", companyIds).del();
        await db("incidents").whereIn("company_id", companyIds).del();
        await db("instance_email_sender_configs").whereIn("channel_id", channelIds).del();
        await db("instance_email_delivery_logs").whereIn("channel_id", channelIds).del();
        await db("instance_email_inbound_actions").whereIn("channel_id", channelIds).del();
        await db("instance_email_channels").whereIn("instance_id", companyIds).del();
        await db("users").whereIn("email", [`g-${owner}`, `d-${owner}`, rita]).del();
        await db("agents")
          .whereIn("email", [`g-${owner}`, `d-${owner}`])
          .del();
        await db("companies").whereIn("id", companyIds).del();
      }
      console.log("CLEANUP OK");
    } catch (cleanErr) {
      console.warn("CLEANUP WARN:", cleanErr.message);
    }
    await db.destroy();
  }
})().catch((err) => {
  console.error("E2E FAILED:", err && err.message || err);
  console.error(err && err.stack ? err.stack.split("\n").slice(0, 8).join("\n") : "");
  process.exit(1);
});