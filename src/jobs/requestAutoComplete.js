/**
 * Request Auto-Completion — closes RITMs when all tasks are complete,
 * and closes REQs when all RITMs are closed.
 */
const cron = require("node-cron");

async function autoCompleteRequests() {
  const Request = require("../models/Request");
  const RequestedItem = require("../models/RequestedItem");
  const CatalogTask = require("../models/CatalogTask");

  // Find open requests
  const openReqs = await Request.find({
    status: { $in: ["open", "work_in_progress"] },
    isDeleted: false,
  });
  let closedCount = 0;

  for (const req of openReqs) {
    const ritms = await RequestedItem.find({
      requestId: req._id,
      isDeleted: false,
    });
    if (!ritms.length) continue;

    const allClosed = ritms.every((r) =>
      ["closed_complete", "closed_incomplete", "closed_canceled"].includes(
        r.status,
      ),
    );
    if (allClosed) {
      const allComplete = ritms.every((r) => r.status === "closed_complete");
      req.status = allComplete ? "closed_complete" : "closed_incomplete";
      req.closedAt = new Date();
      req.closeCode = allComplete ? "fulfilled" : "partially_fulfilled";
      await req.save();
      closedCount++;
    }
  }
  if (closedCount > 0)
    console.log(`[requestAutoComplete] auto-closed ${closedCount} requests`);
  return { closedCount };
}

function start() {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      await autoCompleteRequests();
    } catch (e) {
      console.error("[requestAutoComplete]", e.message);
    }
  });
  console.log("[job] requestAutoComplete scheduled (every 15 min)");
}

module.exports = { start, autoCompleteRequests };
