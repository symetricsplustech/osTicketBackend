/**
 * Reporting-line + operational engineer profile service.
 *
 * Reporting line is intentionally independent from assignment-group
 * membership (spec rule). It records the explicit manager / team-lead /
 * delegated-manager chain with effective dates so the frontend can render
 * "Reporting Line" and "Direct reports" from real data.
 *
 * All queries are tenant-scoped explicitly (tenant_id is always in the WHERE
 * clause) so there is no cross-tenant enumeration.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ApiError(422, `${field} is not a valid date`);
  return d;
}

function normalizeId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const id = String(value);
  if (!UUID_RE.test(id)) throw new ApiError(422, "A valid user id is required");
  return id;
}

function shapeReportingLine(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    memberUserId: row.member_user_id,
    managerUserId: row.manager_user_id,
    teamLeadUserId: row.team_lead_user_id,
    delegatedManagerUserId: row.delegated_manager_user_id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function activeReportingLine(tenantId, memberUserId) {
  if (!tenantId || !memberUserId) return null;
  const row = await getDB()("reporting_lines")
    .where({ tenant_id: tenantId, member_user_id: memberUserId, is_active: true })
    .orderBy("effective_from", "desc")
    .first();
  return shapeReportingLine(row);
}

async function listReportingLines(tenantId, filter = {}) {
  const q = getDB()("reporting_lines").where({ tenant_id: tenantId });
  if (filter.memberUserId) q.where("member_user_id", filter.memberUserId);
  if (filter.managerUserId) {
    q.where((b) =>
      b.where("manager_user_id", filter.managerUserId).orWhere("team_lead_user_id", filter.managerUserId),
    );
  }
  if (filter.activeOnly !== false) q.where("is_active", true);
  const rows = await q.orderBy("effective_from", "desc");
  return rows.map(shapeReportingLine);
}

async function assertNoCycle(tenantId, memberUserId, managerUserId) {
  if (!managerUserId) return;
  if (String(memberUserId) === String(managerUserId)) {
    throw new ApiError(422, "A user cannot report to themselves");
  }
  let current = managerUserId;
  const seen = new Set([String(memberUserId)]);
  for (let depth = 0; depth < 50 && current; depth += 1) {
    if (seen.has(String(current))) {
      throw new ApiError(422, "Reporting line would create a cycle");
    }
    seen.add(String(current));
    const row = await getDB()("reporting_lines")
      .where({ tenant_id: tenantId, member_user_id: current, is_active: true })
      .orderBy("effective_from", "desc")
      .first();
    current = row ? row.manager_user_id : null;
  }
}

/**
 * Replace the active reporting line for a member. Deactivates the previous
 * active row (kept for history) and inserts the new effective row.
 */
async function setReportingLine({
  tenantId,
  memberUserId,
  managerUserId = null,
  teamLeadUserId = null,
  delegatedManagerUserId = null,
  effectiveFrom = null,
  effectiveTo = null,
  notes = null,
  actorId = null,
}) {
  const member = normalizeId(memberUserId);
  if (!member) throw new ApiError(422, "memberUserId is required");
  const manager = normalizeId(managerUserId);
  const teamLead = normalizeId(teamLeadUserId);
  const delegated = normalizeId(delegatedManagerUserId);
  await assertNoCycle(tenantId, member, manager);

  const db = getDB();
  const inserted = await db.transaction(async (trx) => {
    await trx("reporting_lines")
      .where({ tenant_id: tenantId, member_user_id: member, is_active: true })
      .update({ is_active: false, updated_at: db.fn.now() });
    const [row] = await trx("reporting_lines")
      .insert({
        tenant_id: tenantId,
        member_user_id: member,
        manager_user_id: manager,
        team_lead_user_id: teamLead,
        delegated_manager_user_id: delegated,
        effective_from: toDate(effectiveFrom, "effectiveFrom") || db.fn.now(),
        effective_to: toDate(effectiveTo, "effectiveTo"),
        is_active: true,
        notes: notes || null,
        created_by: normalizeId(actorId) || null,
        updated_by: normalizeId(actorId) || null,
      })
      .returning("*");
    return row;
  });
  return shapeReportingLine(inserted);
}

async function clearReportingLine({ tenantId, memberUserId, actorId = null }) {
  const member = normalizeId(memberUserId);
  if (!member) throw new ApiError(422, "memberUserId is required");
  const updated = await getDB()("reporting_lines")
    .where({ tenant_id: tenantId, member_user_id: member, is_active: true })
    .update({ is_active: false, updated_by: normalizeId(actorId) || null, updated_at: getDB().fn.now() });
  return { cleared: updated };
}

async function getDirectReports(tenantId, managerUserId) {
  const manager = normalizeId(managerUserId);
  if (!manager) return [];
  const rows = await getDB()("reporting_lines")
    .where({ tenant_id: tenantId, is_active: true })
    .andWhere((b) =>
      b.where("manager_user_id", manager).orWhere("team_lead_user_id", manager),
    )
    .orderBy("effective_from", "desc");
  return rows.map(shapeReportingLine);
}

/**
 * Walk the manager chain upward. Cycle-safe. Returns ordered ancestors
 * (nearest manager first) with their effective dates.
 */
async function getReportingChain(tenantId, memberUserId, options = {}) {
  const maxDepth = Number(options.maxDepth) > 0 ? Number(options.maxDepth) : 20;
  const chain = [];
  const seen = new Set([String(memberUserId)]);
  let current = normalizeId(memberUserId);
  if (!current) return chain;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const row = await activeReportingLine(tenantId, current);
    if (!row || !row.managerUserId || seen.has(String(row.managerUserId))) break;
    seen.add(String(row.managerUserId));
    chain.push({
      userId: row.managerUserId,
      viaTeamLead: false,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
    });
    current = row.managerUserId;
  }
  return chain;
}

// ── Operational engineer profile ────────────────────────────────────────

function shapeEngineerProfile(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    availability: row.availability || {},
    skills: row.skills || [],
    territories: row.territories || [],
    schedule: row.schedule || {},
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getEngineerProfile(tenantId, userId) {
  const id = normalizeId(userId);
  if (!id) return null;
  const row = await getDB()("engineer_profiles")
    .where({ tenant_id: tenantId, user_id: id })
    .first();
  return shapeEngineerProfile(row);
}

async function upsertEngineerProfile({
  tenantId,
  userId,
  availability,
  skills,
  territories,
  schedule,
  notes,
  actorId = null,
}) {
  const id = normalizeId(userId);
  if (!id) throw new ApiError(422, "userId is required");
  const db = getDB();
  const payload = {
    tenant_id: tenantId,
    user_id: id,
    updated_by: normalizeId(actorId) || null,
    updated_at: db.fn.now(),
  };
  if (availability !== undefined) payload.availability = JSON.stringify(availability || {});
  if (skills !== undefined) payload.skills = JSON.stringify(skills || []);
  if (territories !== undefined) payload.territories = JSON.stringify(territories || []);
  if (schedule !== undefined) payload.schedule = JSON.stringify(schedule || {});
  if (notes !== undefined) payload.notes = notes || null;

  const existing = await db("engineer_profiles")
    .where({ tenant_id: tenantId, user_id: id })
    .first();
  if (existing) {
    const [row] = await db("engineer_profiles").where({ id: existing.id }).update(payload).returning("*");
    return shapeEngineerProfile(row);
  }
  const [row] = await db("engineer_profiles")
    .insert({ ...payload, created_by: normalizeId(actorId) || null })
    .returning("*");
  return shapeEngineerProfile(row);
}

module.exports = {
  activeReportingLine,
  listReportingLines,
  setReportingLine,
  clearReportingLine,
  getDirectReports,
  getReportingChain,
  getEngineerProfile,
  upsertEngineerProfile,
  shapeReportingLine,
};
