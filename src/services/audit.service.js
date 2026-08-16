const AuditEvent = require('../models/AuditEvent');

/**
 * audit({ company, actorType, actor, actorName, action, entityType, entityId,
 *         before, after, reason, req, source })
 * Records WHO/WHAT/WHEN/WHERE with before/after diffs. Never throws.
 */
async function audit({
  company = null,
  actorType = 'system',
  actor = null,
  actorName = '',
  action,
  entityType = '',
  entityId = null,
  before = null,
  after = null,
  reason = '',
  req = null,
  source = '',
}) {
  try {
    const changes = [];
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const k of keys) {
        const b = before[k];
        const a = after[k];
        if (JSON.stringify(b) !== JSON.stringify(a)) {
          changes.push({ field: k, from: b ?? null, to: a ?? null });
        }
      }
    }
    await AuditEvent.create({
      company,
      actorType,
      actor,
      actorName,
      action,
      entityType,
      entityId,
      before: before ?? null,
      after: after ?? null,
      changes: changes.slice(0, 50),
      reason,
      ip: req?.ip || req?.socket?.remoteAddress || '',
      userAgent: req?.get?.('user-agent') || '',
      source: source || (actorType === 'api' ? 'api' : ''),
    });
  } catch (err) {
    // audit must never break the business flow
  }
}

async function auditForEntity({ company, entityType, entityId, page = 1, limit = 50 }) {
  const query = { company, entityType, entityId };
  const items = await AuditEvent.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const total = await AuditEvent.countDocuments(query);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

module.exports = { audit, auditForEntity };