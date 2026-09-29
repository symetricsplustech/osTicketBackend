/**
 * Shared tenant-scoped CRUD for the Phase 15 Asset & Cost Management tables.
 *
 * Every Phase 15 resource is a plain tenant-scoped table with a uuid primary
 * key, so the nine services share one implementation rather than repeating the
 * same scoping, field-filtering, 404 and audit logic nine times.
 *
 * Guarantees for all callers:
 *  - tenant context is required and every read/write filters on company_id,
 *    so one tenant can never see or touch another tenant's rows;
 *  - only columns listed in `fields` are written, so a request body cannot
 *    set company_id, id or created_at;
 *  - unknown ids return 404 rather than silently creating a row;
 *  - create, update and delete write audit events.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");
const auditEventService = require("./auditEventService");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

const requireTenant = (tenantId) => {
  if (!tenantId) throw new ApiError(400, "Tenant context is required");
  return tenantId;
};

const requireId = (id, field = "id") => {
  if (!isUuid(id)) throw new ApiError(422, `A valid ${field} is required`);
  return id;
};

// Only the whitelisted columns whose value was actually supplied.
const pickFields = (data, fields) => {
  const out = {};
  for (const field of fields) {
    if (data && data[field] !== undefined) out[field] = data[field] === "" ? null : data[field];
  }
  return out;
};

const recordEvent = ({ tenantId, actorId, entityType, entityId, action, before, after, extra }) =>
  auditEventService.log({
    tenantId,
    actorId,
    entityType,
    entityId,
    action,
    before,
    after,
    ...(extra || {}),
  });

/**
 * Build CRUD operations for one table.
 *
 * @param {object} config
 * @param {string} config.table     table name
 * @param {string} config.entity    entity label used in audit events
 * @param {string[]} config.fields  writable columns
 * @param {string[]} [config.required] columns that must carry a non-blank value
 * @param {string[]} [config.searchFields] columns matched by `search`
 * @param {string} [config.sort]    default order column
 * @param {(row: object) => object} [config.map] response shaping
 */
function crud({ table, entity, fields, required = [], searchFields = [], sort = "created_at", map }) {
  const shape = map || ((row) => row);

  const wrap = (rows) => rows.map(shape);

  // A blank value for a NOT NULL column would otherwise surface as a Postgres
  // constraint error, so reject it as a validation problem instead.
  const rejectBlankRequired = (values, { partial }) => {
    for (const field of required) {
      if (partial && values[field] === undefined) continue;
      const value = values[field];
      if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
        throw new ApiError(422, `${entity} requires ${field.replace(/_/g, " ")}`);
      }
    }
  };

  return {
    table,
    entity,
    fields,

    async list({ tenantId, filters = {}, search, limit = 200, offset = 0, orderBy, direction = "desc" }) {
      requireTenant(tenantId);
      const db = getDB();
      const query = db(table).where({ company_id: tenantId });
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === "") continue;
        query.andWhere({ [key]: value });
      }
      if (search && searchFields.length) {
        const pattern = `%${String(search).replace(/[%_]/g, (c) => `\\${c}`)}%`;
        // Chained on the return value: separate whereILike calls would each
        // add their own AND and break the OR group.
        query.andWhere((builder) => {
          searchFields.reduce((acc, field) => acc.orWhereILike(field, pattern), builder.whereILike(searchFields[0], pattern));
        });
      }
      // Clone before the paging calls: Knex mutates the builder in place, so
      // counting afterwards would count the limited window instead of all rows.
      const countQuery = query.clone().clearOrder().clearSelect();
      const [rows, total] = await Promise.all([
        query.orderBy(orderBy || sort, direction).limit(limit).offset(offset),
        countQuery.count("* as count").first(),
      ]);
      return { items: wrap(rows), total: Number(total.count) };
    },

    async get({ tenantId, id }) {
      requireTenant(tenantId);
      requireId(id);
      const row = await getDB()(table).where({ id, company_id: tenantId }).first();
      if (!row) throw new ApiError(404, `${entity} not found`);
      return shape(row);
    },

    // Row lookup without throwing, for internal use by other services.
    async findRow({ tenantId, id }) {
      requireTenant(tenantId);
      if (!isUuid(id)) return null;
      return getDB()(table).where({ id, company_id: tenantId }).first();
    },

    async create({ tenantId, data, actorId, defaults = {} }) {
      requireTenant(tenantId);
      const db = getDB();
      const row = {
        company_id: tenantId,
        ...defaults,
        ...pickFields(data, fields),
      };
      rejectBlankRequired(row, { partial: false });
      const [created] = await db(table).insert(row).returning("*");
      await recordEvent({
        tenantId,
        actorId,
        entityType: entity,
        entityId: created.id,
        action: "create",
        before: null,
        after: shape(created),
      });
      return shape(created);
    },

    async update({ tenantId, id, data, actorId }) {
      requireTenant(tenantId);
      const db = getDB();
      const before = await db(table).where({ id, company_id: tenantId }).first();
      if (!before) throw new ApiError(404, `${entity} not found`);
      const changes = pickFields(data, fields);
      rejectBlankRequired(changes, { partial: true });
      if (!Object.keys(changes).length) return shape(before);
      const [after] = await db(table).where({ id, company_id: tenantId }).update(changes).returning("*");
      await recordEvent({
        tenantId,
        actorId,
        entityType: entity,
        entityId: id,
        action: "update",
        before: shape(before),
        after: shape(after),
      });
      return shape(after);
    },

    async remove({ tenantId, id, actorId }) {
      requireTenant(tenantId);
      const db = getDB();
      const before = await db(table).where({ id, company_id: tenantId }).first();
      if (!before) throw new ApiError(404, `${entity} not found`);
      await db(table).where({ id, company_id: tenantId }).del();
      await recordEvent({
        tenantId,
        actorId,
        entityType: entity,
        entityId: id,
        action: "delete",
        before: shape(before),
        after: null,
      });
      return { deleted: true, id };
    },

    /**
     * Apply a validated lifecycle transition.
     *
     * `transitions` is the full state machine, so terminal states map to an
     * empty list and cannot be moved anywhere. An illegal target is rejected
     * with 409 before any write, and the transition is audited.
     */
    async transition({ tenantId, id, transitions, to, actorId, patch = {}, label = "state" }) {
      requireTenant(tenantId);
      const db = getDB();
      const before = await db(table).where({ id, company_id: tenantId }).first();
      if (!before) throw new ApiError(404, `${entity} not found`);
      const legal = transitions[before[label]] || [];
      if (!legal.includes(to)) {
        throw new ApiError(409, `Illegal ${entity} transition: ${before[label]} -> ${to}`);
      }
      const changes = {};
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) changes[key] = value;
      }
      const [after] = await db(table)
        .where({ id, company_id: tenantId })
        .update({ ...changes, [label]: to })
        .returning("*");
      await recordEvent({
        tenantId,
        actorId,
        entityType: entity,
        entityId: id,
        action: `transition:${before[label]}->${to}`,
        before: shape(before),
        after: shape(after),
      });
      return shape(after);
    },
  };
}

module.exports = { crud, isUuid, requireId, requireTenant, pickFields, recordEvent };
