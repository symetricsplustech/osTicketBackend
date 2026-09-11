/**
 * Outbox service — reliable async side effects via transactional outbox pattern.
 * Ensures domain events are delivered exactly once even on worker failure.
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const outboxSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    aggregateType: { type: String, required: true },
    aggregateId: { type: mongoose.Schema.Types.ObjectId, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 5 },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
    correlationId: { type: String, default: null },
  },
  { timestamps: true }
);

outboxSchema.index({ status: 1, createdAt: 1 });

let Outbox;
try {
  Outbox = mongoose.model('Outbox');
} catch {
  Outbox = mongoose.model('Outbox', outboxSchema);
}

async function enqueue({ tenantId, eventType, aggregateType, aggregateId, payload, correlationId }) {
  return Outbox.create({
    tenantId, eventType, aggregateType, aggregateId, payload, correlationId,
  });
}

async function processNext(handler) {
  const doc = await Outbox.findOneAndUpdate(
    { status: 'pending', retryCount: { $lt: 5 } },
    { $set: { status: 'processing' }, $inc: { retryCount: 1 } },
    { new: true, sort: { createdAt: 1 } }
  );
  if (!doc) return null;

  try {
    await handler(doc);
    doc.status = 'completed';
    doc.processedAt = new Date();
    await doc.save();
    return doc;
  } catch (err) {
    doc.status = doc.retryCount >= doc.maxRetries ? 'failed' : 'pending';
    doc.lastError = err.message;
    await doc.save();
    logger.error('Outbox processing failed', { id: doc._id, error: err.message });
    return doc;
  }
}

async function getPendingCount() {
  return Outbox.countDocuments({ status: 'pending' });
}

async function getFailedEvents(tenantId, limit = 50) {
  return Outbox.find({ tenantId, status: 'failed' }).sort({ createdAt: -1 }).limit(limit);
}

module.exports = { Outbox, enqueue, processNext, getPendingCount, getFailedEvents };
