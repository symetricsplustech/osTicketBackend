/**
 * Outbox model — transactional outbox for reliable domain event delivery.
 * This is a lightweight shim; the actual table is managed via migrations.
 */
const { getDB } = require("../config/db");

const TABLE = "outbox";

const Outbox = {
  async create(data) {
    const db = getDB();
    const [row] = await db(TABLE).insert(data).returning("*");
    return row;
  },
  async find(query = {}) {
    const db = getDB();
    let q = db(TABLE).select("*");
    if (query.status) q = q.where("status", query.status);
    if (query.tenantId) q = q.where("tenant_id", query.tenantId);
    if (query.id) q = q.where("id", query.id);
    return q.orderBy("created_at", "asc");
  },
  async findOne(query = {}) {
    const db = getDB();
    let q = db(TABLE).select("*");
    if (query.status) q = q.where("status", query.status);
    if (query.tenantId) q = q.where("tenant_id", query.tenantId);
    if (query.id) q = q.where("id", query.id);
    return q.first();
  },
  async countDocuments(query = {}) {
    const db = getDB();
    let q = db(TABLE);
    if (query.status) q = q.where("status", query.status);
    const [{ count }] = await q.count("* as count");
    return Number(count);
  },
};

module.exports = Outbox;
