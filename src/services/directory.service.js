/**
 * Users Directory projection for an instance.
 *
 * Builds the directory row the spec requires (membership status, organization
 * placement, manager/team lead, groups vs assignment groups, role summary,
 * access status, last sign-in) from real tables. No inferred reporting line:
 * manager/team-lead come only from reporting_lines.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, field) {
  if (!value || !UUID_RE.test(String(value))) throw new ApiError(422, `${field} must be a valid id`);
  return String(value);
}

function indexById(rows) {
  const map = new Map();
  for (const row of rows || []) map.set(String(row.id), row);
  return map;
}

function placementFromUnit(unitId, unitMap) {
  const placement = { company: null, businessUnit: null, department: null, location: null, unitPath: [] };
  let current = unitId ? unitMap.get(String(unitId)) : null;
  const guard = new Set();
  while (current && !guard.has(String(current.id))) {
    guard.add(String(current.id));
    placement.unitPath.unshift({ id: current.id, name: current.name, type: current.type });
    const type = String(current.type || "").toLowerCase();
    if (type.includes("company") && !placement.company) placement.company = current.name;
    else if (type.includes("department") && !placement.department) placement.department = current.name;
    else if (type.includes("location") && !placement.location) placement.location = current.name;
    else if (type.includes("business") && !placement.businessUnit) placement.businessUnit = current.name;
    current = current.parent_id ? unitMap.get(String(current.parent_id)) : null;
  }
  return placement;
}

async function buildDirectory(tenantId, instanceId, options = {}) {
  const tenant = assertUuid(tenantId, "tenantId");
  const instance = assertUuid(instanceId, "instanceId");
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 25));
  const db = getDB();

  const base = db("users").whereRaw("instance_memberships @> ?::jsonb", [
    JSON.stringify([{ instance }]),
  ]);
  if (options.userId) {
    base.where("id", assertUuid(options.userId, "userId"));
  }
  if (options.search) {
    const term = `%${String(options.search).trim()}%`;
    base.where((b) => b.whereILike("name", term).orWhereILike("email", term));
  }

  const countRow = await base.clone().count({ count: "*" }).first();
  const total = Number(countRow?.count || 0);

  const users = await base
    .clone()
    .select("id", "name", "email", "last_login", "status", "instance_memberships")
    .orderBy("name", "asc")
    .limit(limit)
    .offset((page - 1) * limit);

  const userIds = users.map((u) => u.id);
  if (!userIds.length) {
    return { items: [], total, page, limit, totalPages: Math.ceil(total / limit) || 0 };
  }

  const [reportingRows, roleRows, groupRows] = await Promise.all([
    db("reporting_lines")
      .where({ tenant_id: tenant, is_active: true })
      .whereIn("member_user_id", userIds),
    db("user_roles as ur")
      .join("roles as r", "r.id", "ur.role_id")
      .where("ur.tenant_id", tenant)
      .whereIn("ur.user_id", userIds)
      .select("ur.user_id", "r.id", "r.name"),
    db("group_memberships as gm")
      .join("teams as t", "t.id", "gm.group_id")
      .where("gm.tenant_id", tenant)
      .whereIn("gm.user_id", userIds)
      .select("gm.user_id", "t.id", "t.name", "t.kind", "gm.role"),
  ]);

  const reportingByUser = new Map();
  for (const row of reportingRows) reportingByUser.set(String(row.member_user_id), row);

  const rolesByUser = new Map();
  for (const row of roleRows) {
    const list = rolesByUser.get(String(row.user_id)) || [];
    list.push({ id: row.id, name: row.name });
    rolesByUser.set(String(row.user_id), list);
  }

  const groupsByUser = new Map();
  const assignmentGroupsByUser = new Map();
  for (const row of groupRows) {
    const target = row.kind === "assignment_group" ? assignmentGroupsByUser : groupsByUser;
    const list = target.get(String(row.user_id)) || [];
    list.push({ id: row.id, name: row.name, role: row.role });
    target.set(String(row.user_id), list);
  }

  const unitIds = new Set();
  const managerIds = new Set();
  for (const user of users) {
    const membership = (user.instance_memberships || []).find(
      (m) => String(m.instance) === instance,
    );
    if (membership?.organizationUnit) unitIds.add(String(membership.organizationUnit));
    const line = reportingByUser.get(String(user.id));
    if (line?.manager_user_id) managerIds.add(String(line.manager_user_id));
    if (line?.team_lead_user_id) managerIds.add(String(line.team_lead_user_id));
  }

  const [unitRows, managerRows] = await Promise.all([
    unitIds.size
      ? db("organization_units").whereIn("id", [...unitIds]).select("id", "name", "type", "parent_id")
      : Promise.resolve([]),
    managerIds.size
      ? db("users").whereIn("id", [...managerIds]).select("id", "name")
      : Promise.resolve([]),
  ]);

  const unitMap = indexById(unitRows);
  const managerMap = indexById(managerRows);

  const items = users.map((user) => {
    const membership = (user.instance_memberships || []).find(
      (m) => String(m.instance) === instance,
    ) || {};
    const line = reportingByUser.get(String(user.id)) || null;
    const placement = placementFromUnit(membership.organizationUnit, unitMap);
    const roleSummary = rolesByUser.get(String(user.id)) || [];
    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      membershipStatus: membership.status || "unknown",
      role: membership.role || null,
      company: placement.company,
      businessUnit: placement.businessUnit,
      department: placement.department,
      location: placement.location,
      organizationUnit: membership.organizationUnit || null,
      unitPath: placement.unitPath,
      managerUserId: line ? line.manager_user_id : null,
      managerName: line && line.manager_user_id ? managerMap.get(String(line.manager_user_id))?.name || null : null,
      teamLeadUserId: line ? line.team_lead_user_id : null,
      teamLeadName: line && line.team_lead_user_id ? managerMap.get(String(line.team_lead_user_id))?.name || null : null,
      groups: groupsByUser.get(String(user.id)) || [],
      assignmentGroups: assignmentGroupsByUser.get(String(user.id)) || [],
      roleSummary,
      accessStatus: membership.status === "active" ? "active" : membership.status || "inactive",
      lastSignIn: user.last_login || null,
    };
  });

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 0 };
}

module.exports = { buildDirectory };
