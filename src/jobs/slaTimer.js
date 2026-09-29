/**
 * SLA timer background job — checks for breached SLAs on a schedule.
 * Run via: node src/jobs/slaTimer.js
 */
const { getDB } = require("../config/db");
const { checkBreaches } = require("../services/taskSla.service");
const logger = require("../utils/logger");

async function connect() {
  getDB();
  logger.info("SLA timer connected to database");
}

async function run() {
  const tenants = await getDB()("companies").select("id").distinct("id");
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
