const AuditEvent = require("../models/core/AuditEvent");
const { getDB } = require("../config/db");

async function auditRequired({
  company,
  actorType = "system",
  actor = null,
  actorName = "",
  action,
  entityType = "",
  entityId,
  before = null,
  after = null,
  reason = "",
  req = null,
  source = "",
}) {
  const tenantId = company?.id || company?._id || company;
  const resourceId = entityId?.id || entityId?._id || entityId;
  if (!tenantId || !resourceId || !action || !entityType) {
    throw new Error(
      "Required audit event is missing tenant, resource, or action",
    );
  }
  await getDB()("audit_events").insert({
    tenant_id: tenantId,
    resource_type: entityType,
    resource_id: resourceId,
    actor_id: actorType === "user" ? actor?.id || actor?._id || actor : null,
    action,
    old_values: JSON.stringify(before || {}),
    new_values: JSON.stringify({
      ...(after || {}),
      _audit: { actorType, actor, actorName, reason, source },
    }),
    ip: req?.ip || req?.socket?.remoteAddress || "",
    user_agent: req?.get?.("user-agent") || "",
  });
}

/**
 * audit({ company, actorType, actor, actorName, action, entityType, entityId,
 *         before, after, reason, req, source })
 * Records WHO/WHAT/WHEN/WHERE with before/after diffs. Never throws.
 */
async function audit({
  company = null,
  actorType = "system",
  actor = null,
  actorName = "",
  action,
  entityType = "",
  entityId = null,
  before = null,
  after = null,
  reason = "",
  req = null,
  source = "",
}) {
  try {
    if (company && entityId)
      await auditRequired({
        company,
        actorType,
        actor,
        actorName,
        action,
        entityType,
        entityId,
        before,
        after,
        reason,
        req,
        source,
      });
  } catch (err) {
    // audit must never break the business flow
  }
}

async function auditForEntity({
  company,
  entityType,
  entityId,
  page = 1,
  limit = 50,
}) {
  const query = { company, entityType, entityId };
  const items = await AuditEvent.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const total = await AuditEvent.countDocuments(query);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

module.exports = { audit, auditRequired, auditForEntity };
