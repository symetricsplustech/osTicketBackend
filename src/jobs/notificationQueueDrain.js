/**
 * Notification queue drain — delivers notifications deferred by quiet-hours
 * once the quiet window has ended.
 * Run via: node src/jobs/notificationQueueDrain.js
 */
const { drainQueue } = require("../services/quietHours.service");

async function run() {
  const result = await drainQueue();
  if (result.scanned > 0)
    console.log(
      `[notificationQueueDrain] scanned ${result.scanned}, delivered ${result.delivered}`,
    );
  return result;
}

function start() {
  // Run every minute
  setInterval(async () => {
    try {
      await run();
    } catch (e) {
      console.error("[notificationQueueDrain]", e.message);
    }
  }, 60 * 1000);
  console.log("[job] notificationQueueDrain scheduled (every minute)");
}

module.exports = { start, run };

if (require.main === module) {
  run().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exitCode = 1;
    },
  );
}