/**
 * Centralized record numbering (MD §68).
 *
 * Tenant-specific, collision-safe (atomic findOneAndUpdate with upsert),
 * sequential: INC-000001, PRB-000001, CHG-000001, REQ-000001, RITM-000001,
 * TASK-000001. Counters are per-tenant so one tenant's volume never leaks
 * into another's numbering.
 *
 * NOTE: legacy Ticket numbers keep the existing random generator
 * (utils/generators.generateTicketNumber) — it is unique-indexed, working
 * and covered by portal tests. New ITSM entities use this service.
 */

const Counter = require('../models/Counter');

const PREFIXES = ['INC', 'PRB', 'CHG', 'REQ', 'RITM', 'TASK'];

function formatNumber(prefix, seq) {
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

/**
 * Atomically reserve the next sequence for a tenant+prefix.
 * Safe under concurrency (single-document atomic update).
 */
async function nextSequence(tenantId, prefix) {
  if (!tenantId) throw new Error('tenantId is required for numbering');
  if (!PREFIXES.includes(prefix)) throw new Error(`unknown numbering prefix: ${prefix}`);
  const doc = await Counter.findOneAndUpdate(
    { _id: `${tenantId}:${prefix}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

async function nextNumber(tenantId, prefix) {
  const seq = await nextSequence(tenantId, prefix);
  return formatNumber(prefix, seq);
}

module.exports = { PREFIXES, formatNumber, nextSequence, nextNumber };
