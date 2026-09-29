/**
 * QueuedNotification model — stores notifications deferred during quiet-hours.
 * Backed by the queued_notifications table (see migration
 * 20260919000001_queued_notifications.js).
 */
const { getDB } = require("../config/db");

const TABLE = "queued_notifications";

function hydrate(row) {
  if (!row) return null;
  if (row.payload && typeof row.payload === "string") {
    try {
      row.payload = JSON.parse(row.payload);
    } catch (_) {}
  }
  const doc = { ...row, _id: row.id };
  doc.save = async function () {
    const db = getDB();
    const updates = { delivered: !!doc.delivered };
    if (doc.deliveredAt) updates.deliveredAt = doc.deliveredAt;
    const [saved] = await db(TABLE)
      .where("id", doc.id)
      .update(updates)
      .returning("*");
    Object.assign(doc, saved);
    return doc;
  };
  return doc;
}

const QueuedNotification = {
  async create(data) {
    const db = getDB();
    const [row] = await db(TABLE)
      .insert({
        tenantId: data.tenantId,
        channel: data.channel || "email",
        recipientType: data.recipientType || "agent",
        recipient: data.recipient,
        payload: data.payload || {},
        deliverAfter: data.deliverAfter,
        delivered: false,
      })
      .returning("*");
    return hydrate(row);
  },
  async find(query = {}) {
    const db = getDB();
    let q = db(TABLE).select("*");
    if (query.delivered !== undefined)
      q = q.where("delivered", query.delivered);
    if (query.deliverAfter)
      q = q.where("deliver_after", "<=", query.deliverAfter);
    if (query.tenantId) q = q.where("tenant_id", query.tenantId);
    if (query.limit) q = q.limit(query.limit);
    if (query.sort) q = q.orderBy(query.sort);
    const rows = await q;
    return rows.map(hydrate);
  },
  async findOneAndUpdate(filter, update, opts = {}) {
    const db = getDB();
    const set = update.$set || update;
    const q = db(TABLE);
    if (filter._id) q.where("id", filter._id);
    if (filter.tenantId) q.where("tenant_id", filter.tenantId);
    let [row] = await q.update(set).returning("*");
    return hydrate(row);
  },
};

module.exports = QueuedNotification;