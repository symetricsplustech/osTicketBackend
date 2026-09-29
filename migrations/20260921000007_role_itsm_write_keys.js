/**
 * Roles are missing the itsm.* write keys needed by the 1.1 problem/change
 * flow HTTP endpoints (requirePermission guards on src/routes/core/problem.js
 * and src/routes/core/change.js).  The authorization.service reads role.permissions
 * directly, so adding these additive jsonb elements unblocks the routes for the
 * existing agent roles without touching any other role.
 *
 * Service Desk L2  -> problem CRUD + assign + change CRUD
 * Incident Manager  -> problem update + change CRUD
 * Change Approver   -> change CRUD
 * ITSM Admin already carries itsm.* (covers all).
 * Read-Only Operations stays read-only by design.
 */

const ADMIN = ["itsm.problem.problem.create", "itsm.problem.problem.update", "itsm.problem.assign", "itsm.change.change_request.create", "itsm.change.change_request.update"];
const MANAGER = ["itsm.problem.problem.update", "itsm.change.change_request.create", "itsm.change.change_request.update"];
const APPROVER = ["itsm.change.change_request.create", "itsm.change.change_request.update"];

exports.up = async function (knex) {
  for (const name of ["Service Desk L2", "Incident Manager", "Change Approver"]) {
    const row = await knex("roles").where({ name }).first();
    if (!row) continue;
    const raw = row.permissions;
    const current = typeof raw === "string" ? JSON.parse(raw) : (raw || []);
    const perms = new Set(current.filter(Boolean));
    const keys = name === "Service Desk L2" ? ADMIN : name === "Incident Manager" ? MANAGER : APPROVER;
    for (const k of keys) perms.add(k);
    await knex("roles").where({ name }).update({ permissions: JSON.stringify([...perms]), updated_at: knex.fn.now() });
  }
};

exports.down = async function (knex) {
  for (const name of ["Service Desk L2", "Incident Manager", "Change Approver"]) {
    const row = await knex("roles").where({ name }).first();
    if (!row) continue;
    const remove = name === "Service Desk L2" ? ADMIN : name === "Incident Manager" ? MANAGER : APPROVER;
    const raw = row.permissions;
    const current = typeof raw === "string" ? JSON.parse(raw) : (raw || []);
    const perms = current.filter((p) => !remove.includes(p));
    await knex("roles").where({ name }).update({ permissions: JSON.stringify(perms), updated_at: knex.fn.now() });
  }
};
