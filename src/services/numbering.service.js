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

const Counter = require("../models/Counter");
const {
  generateTicketNumber: legacyTicketNumber,
} = require("../utils/generators");

const PREFIXES = ["INC", "PRB", "CHG", "REQ", "RITM", "TASK", "KB", "KBART", "ARULE", "QUEUE", "SKILL", "RRULE", "TYT", "CAT", "CCAT", "CATITEM", "VS", "CART", "SCTASK", "FP", "SPF", "BSVC", "TSVC", "SOFF", "CI", "SLC", "OLA", "UC", "IMP", "INIT", "ITK", "IGL", "BEN", "CST", "MBL", "MTR", "REL", "RCMP", "RDEP", "RAP", "RPH", "RTK", "OUT", "OCS", "WLOC", "WSVC", "WQ", "WCHK", "WAPT", "KIOSK"];

function formatNumber(prefix, seq) {
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

// Numbering prefixes are record-number labels, not a security boundary;
// accept any well-formed uppercase prefix so new record families do not
// silently fail on an out-of-date allow list.
function isAllowedPrefix(prefix) {
  return /^[A-Z]{2,10}$/.test(prefix);
}

/**
 * Atomically reserve the next sequence for a tenant+prefix.
 * Safe under concurrency (single-document atomic update).
 */
async function nextSequence(tenantId, prefix) {
  if (!tenantId) throw new Error("tenantId is required for numbering");
  if (!isAllowedPrefix(prefix))
    throw new Error(`unknown numbering prefix: ${prefix}`);
  const doc = await Counter.findOneAndUpdate(
    { _id: `${tenantId}:${prefix}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}

async function nextNumber(tenantId, prefix) {
  const seq = await nextSequence(tenantId, prefix);
  return formatNumber(prefix, seq);
}

function formatTicketNumber(year, seq) {
  return `TKT-${year}-${String(seq).padStart(8, "0")}`;
}

/**
 * Global yearly ticket sequence: TKT-2026-00001234. Global (not per-tenant)
 * because Ticket.number carries a global unique index — per-tenant sequences
 * would collide across tenants. The counter document is per-year, reserved
 * atomically. Legacy random numbers stay valid; on any failure we fall back
 * to the legacy generator so creation never blocks.
 */
async function nextTicketNumber() {
  try {
    const year = new Date().getFullYear();
    const doc = await Counter.findOneAndUpdate(
      { _id: `GLOBAL:TKT:${year}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    const number = formatTicketNumber(year, doc.seq);
    const Ticket = require("../models/helpdesk/tickets/Ticket");
    const exists = await Ticket.exists({ number });
    if (!exists) return number;
  } catch (_) {
    // fall through to legacy
  }
  return legacyTicketNumber();
}

module.exports = {
  PREFIXES,
  formatNumber,
  nextSequence,
  nextNumber,
  formatTicketNumber,
  nextTicketNumber,
};
