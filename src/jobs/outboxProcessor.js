/**
 * Outbox processor background job — picks up pending events and dispatches them.
 * Run via: node src/jobs/outboxProcessor.js
 */
const mongoose = require('mongoose');
const config = require('../config/config');
const { processNext, getPendingCount } = require('../services/outbox.service');
const { getIO } = require('../config/socket');
const logger = require('../utils/logger');

async function connect() {
  await mongoose.connect(config.mongoUri);
  logger.info('Outbox processor connected to MongoDB');
}

async function dispatchHandler(event) {
  try {
    const io = getIO();
    if (io) {
      io.to(`tenant:${event.tenantId}`).emit(event.eventType, {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        correlationId: event.correlationId,
      });
    }
  } catch (err) {
    logger.error('Outbox dispatch failed', { error: err.message, eventType: event.eventType });
    throw err;
  }
}

async function processBatch(batchSize = 10) {
  let processed = 0;
  for (let i = 0; i < batchSize; i++) {
    const result = await processNext(dispatchHandler);
    if (!result) break;
    processed++;
  }
  return processed;
}

async function start(intervalMs = 5000) {
  await connect();
  logger.info(`Outbox processor started, interval: ${intervalMs}ms`);
  const timer = setInterval(async () => {
    try {
      const pending = await getPendingCount();
      if (pending > 0) {
        const processed = await processBatch(10);
        logger.info(`Outbox batch processed: ${processed}`);
      }
    } catch (err) {
      logger.error('Outbox processor error', { error: err.message });
    }
  }, intervalMs);
  return timer;
}

if (require.main === module) {
  start().catch((err) => {
    logger.error('Outbox processor failed to start', { error: err.message });
    process.exit(1);
  });
}

module.exports = { start, processBatch };
