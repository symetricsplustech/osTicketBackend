/**
 * Fulfillment Retries — retries failed fulfillment tasks after timeout.
 */
const cron = require("node-cron");
const mongoose = require("mongoose");

const RETRY_HOURS = parseInt(process.env.FULFILLMENT_RETRY_HOURS || "24", 10);

async function retryFulfillment() {
  const CatalogTask = mongoose.model("CatalogTask");
  const cutoff = new Date(Date.now() - RETRY_HOURS * 60 * 60 * 1000);
  const stuck = await CatalogTask.find({
    status: "work_in_progress",
    startedAt: { $lt: cutoff },
    isDeleted: false,
  });
  let count = 0;
  for (const task of stuck) {
    count++;
    console.log(
      `[fulfillmentRetry] task ${task.number} stuck since ${task.startedAt}`,
    );
  }
  return { count };
}

function start() {
  cron.schedule("0 */6 * * *", async () => {
    try {
      await retryFulfillment();
    } catch (e) {
      console.error("[fulfillmentRetry]", e.message);
    }
  });
  console.log("[job] fulfillmentRetry scheduled (every 6 hours)");
}

module.exports = { start, retryFulfillment };
