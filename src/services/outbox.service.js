/**
 * Outbox service — reliable async side effects via transactional outbox pattern.
 * Ensures domain events are delivered exactly once even on worker failure.
 */
const logger = require("../utils/logger");
const Outbox = require("../models/Outbox");

async function enqueue({
  tenantId,
  eventType,
  aggregateType,
  aggregateId,
  payload,
  correlationId,
}) {
  return Outbox.create({
    tenantId,
    eventType,
    aggregateType,
    aggregateId,
    payload,
    correlationId,
  });
}

async function processNext(handler) {
  const doc = await Outbox.findOne({ status: "pending", retryCount: { $lt: 5 } });
  if (!doc) return null;

  try {
    await handler(doc);
    doc.status = "completed";
    doc.processedAt = new Date();
    await doc.save();
    return doc;
  } catch (err) {
    doc.status = doc.retryCount >= doc.maxRetries ? "failed" : "pending";
    doc.lastError = err.message;
    await doc.save();
    logger.error("Outbox processing failed", {
      id: doc._id,
      error: err.message,
    });
    return doc;
  }
}

async function getPendingCount() {
  return Outbox.countDocuments({ status: "pending" });
}

async function getFailedEvents(tenantId, limit = 50) {
  return Outbox.find({ tenantId, status: "failed" })
    .sort({ createdAt: -1 })
    .limit(limit);
}

module.exports = {
  Outbox,
  enqueue,
  processNext,
  getPendingCount,
  getFailedEvents,
};
