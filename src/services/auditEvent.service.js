/**
 * Audit event service — records actor, tenant, action, target, before/after, correlation ID.
 * Every important mutation must call this service.
 */
const AuditEvent = require("../models/core/AuditEvent");
const logger = require("../utils/logger");

async function record({
  tenantId,
  entityType,
  entityId,
  action,
  actor,
  before,
  after,
  ipAddress,
  userAgent,
  correlationId,
}) {
  try {
    return await AuditEvent.create({
      tenantId,
      actorId: actor || null,
      resourceType: entityType || null,
      resourceId: entityId || null,
      action,
      oldValues: before || {},
      newValues: after || {},
      ip: ipAddress || "",
      userAgent: userAgent || "",
      correlationId,
    });
  } catch (err) {
    logger.error("AuditEvent create failed", {
      error: err.message,
      entityId,
      action,
    });
    return null;
  }
}

async function recordDenial({
  tenantId,
  entityType,
  entityId,
  action,
  actor,
  denialReason,
  correlationId,
  ipAddress,
  userAgent,
}) {
  return record({
    tenantId,
    entityType,
    entityId,
    action,
    actor,
    outcome: "denied",
    denialReason,
    correlationId,
    ipAddress,
    userAgent,
  });
}

async function listEvents({
  tenantId,
  entityType,
  entityId,
  action,
  actor,
  page = 1,
  limit = 50,
  startDate,
  endDate,
}) {
  const query = { tenantId };
  if (entityType) query.resourceType = entityType;
  if (entityId) query.resourceId = entityId;
  if (action) query.action = action;
  if (actor) query.actorId = actor;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    AuditEvent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actorId", "name email"),
    AuditEvent.countDocuments(query),
  ]);
  return { events, total, page, limit, pages: Math.ceil(total / limit) };
}

module.exports = { record, recordDenial, listEvents };
