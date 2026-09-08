/**
 * Unified task behaviors (ServiceNow "task table lineage" equivalent).
 *
 * Incident / problem / change / ticket share assignment, controlled status
 * transitions and audit stamping THROUGH HERE so the rules can't drift per
 * controller. Controllers keep their own scoping/permission checks and call
 * these primitives for the mutation itself.
 */

const ApiError = require('../utils/ApiError');
const { assertTransition } = require('./stateMachine.service');

async function findTenantRecord(Model, id, tenantId, label = 'Record') {
  const doc = await Model.findOne({ _id: id, ...(tenantId ? { company: tenantId } : {}) });
  if (!doc) throw new ApiError(404, `${label} not found`);
  return doc;
}

/**
 * Guarded status change shared by all ITSM entities.
 * entity: 'ticket' | 'incident' | 'problem' | 'change' | 'faq'
 */
async function transitionRecord({ entity, doc, to, customStatuses = [], stamp = {} }) {
  if (!doc) throw new ApiError(404, 'Record not found');
  const from = doc.status;
  if (to && to !== from) assertTransition(entity, from, to, customStatuses);
  if (to) doc.status = to;
  Object.assign(doc, stamp);
  await doc.save();
  return { from, to: doc.status };
}

/**
 * Shared assignment: set owner and/or team, stamp assignment time.
 */
async function assignRecord({ doc, agentId, teamId, stamp = {} }) {
  if (!doc) throw new ApiError(404, 'Record not found');
  if (agentId !== undefined) doc.agent = agentId || null;
  if (teamId !== undefined) doc.team = teamId || null;
  doc.assignedAt = doc.assignedAt || new Date();
  Object.assign(doc, stamp);
  await doc.save();
  return doc;
}

// ---------------------------------------------------------------------------
// Change safety (MD ITSM-05): conflict detection + deterministic risk score.
// ---------------------------------------------------------------------------

const overlaps = (aStart, aEnd, bStart, bEnd) => {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
};

/**
 * findChangeConflicts({ Change, BlackoutWindow, tenantId, windowStart,
 * windowEnd, assetIds, excludeId }) — overlapping scheduled changes,
 * blackout-window collisions and shared-asset (CI) overlaps.
 */
async function findChangeConflicts({ Change, BlackoutWindow, tenantId, windowStart, windowEnd, assetIds = [], excludeId = null }) {
  const conflicts = { overlapping: [], blackouts: [], sharedAssets: [] };
  if (!windowStart || !windowEnd) return conflicts;
  const scope = tenantId ? { company: tenantId } : {};
  const start = new Date(windowStart);
  const end = new Date(windowEnd);

  const scheduled = await Change.find({
    ...scope,
    status: { $in: ['approved', 'scheduled', 'implementing'] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    windowStart: { $lt: end },
    windowEnd: { $gt: start },
  })
    .select('number title status windowStart windowEnd linkedAssets')
    .limit(25)
    .lean();
  conflicts.overlapping = scheduled.map((c) => ({
    id: String(c._id), number: c.number, title: c.title, status: c.status,
    windowStart: c.windowStart, windowEnd: c.windowEnd,
  }));

  if (BlackoutWindow) {
    try {
      const blackouts = await BlackoutWindow.find({
        $or: [{ tenantId }, { company: tenantId }].filter((q) => Object.values(q)[0]),
        start: { $lt: end },
        end: { $gt: start },
      }).select('name start end').limit(10).lean();
      conflicts.blackouts = blackouts.map((b) => ({ id: String(b._id), name: b.name, start: b.start, end: b.end }));
    } catch (_) { /* blackout store unavailable */ }
  }

  const mine = new Set((assetIds || []).map(String));
  if (mine.size) {
    for (const c of scheduled) {
      const shared = (c.linkedAssets || []).map(String).filter((a) => mine.has(a));
      if (shared.length) {
        conflicts.sharedAssets.push({ changeId: String(c._id), number: c.number, title: c.title, assets: shared });
      }
    }
  }
  return conflicts;
}

/**
 * Deterministic risk score 0..100 (auditable, no ML): type/risk base +
 * conflict load + missing backout plan. Stored on Change.riskScore.
 */
function scoreChangeRisk(change, conflicts = { overlapping: [], blackouts: [], sharedAssets: [] }) {
  let score = 0;
  if (change.type === 'emergency') score += 30;
  else if (change.type === 'normal') score += 10;
  if (change.risk === 'critical') score += 25;
  else if (change.risk === 'high') score += 15;
  else if (change.risk === 'medium') score += 5;
  score += Math.min(25, (conflicts.overlapping?.length || 0) * 10 + (conflicts.blackouts?.length || 0) * 10 + (conflicts.sharedAssets?.length || 0) * 5);
  if (!change.rollbackPlan) score += 15;
  return Math.min(100, score);
}

module.exports = {
  findTenantRecord,
  transitionRecord,
  assignRecord,
  overlaps,
  findChangeConflicts,
  scoreChangeRisk,
};
