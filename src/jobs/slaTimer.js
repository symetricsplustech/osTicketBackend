/**
 * SLA timer background job — checks for breached SLAs on a schedule.
 * Run via: node src/jobs/slaTimer.js
 */
const mongoose = require("mongoose");
const config = require("../config/config");
const { checkBreaches } = require("../services/taskSla.service");
const logger = require("../utils/logger");

async function connect() {
  await mongoose.connect(config.mongoUri);
  logger.info("SLA timer connected to MongoDB");
}

async function run() {
  const tenants = await mongoose.connection.db
    .collection("companies")
    .distinct("_id");
  let total = 0;
  for (const tenantId of tenants) {
    const breached = await checkBreaches(tenantId);
    total += breached;
  }
  logger.info(`SLA timer check complete. Breached: ${total}`);
  return total;
}

async function start(intervalMs = 60000) {
  await connect();
  logger.info(`SLA timer started, interval: ${intervalMs}ms`);
  const timer = setInterval(async () => {
    try {
      await run();
    } catch (err) {
      logger.error("SLA timer error", { error: err.message });
    }
  }, intervalMs);
  return timer;
}

if (require.main === module) {
  start().catch((err) => {
    logger.error("SLA timer failed to start", { error: err.message });
    process.exit(1);
  });
}

module.exports = { start, run };
