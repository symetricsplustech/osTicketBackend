/**
 * Request Approval Reminders — sends reminders for pending approvals.
 */
const cron = require("node-cron");
const mongoose = require("mongoose");

const REMINDER_HOURS = parseInt(
  process.env.APPROVAL_REMINDER_HOURS || "48",
  10,
);

async function sendApprovalReminders() {
  const RequestApproval = mongoose.model("RequestApproval");
  const cutoff = new Date(Date.now() - REMINDER_HOURS * 60 * 60 * 1000);
  const pending = await RequestApproval.find({
    status: "pending",
    isDeleted: false,
    createdAt: { $lt: cutoff },
  }).populate("requestedItemId", "number catalogItemName");
  let count = 0;
  for (const approval of pending) {
    const overdueApprovers = (approval.approvers || []).filter(
      (a) => a.status === "pending",
    );
    if (overdueApprovers.length > 0) {
      count++;
      console.log(
        `[approvalReminder] ${approval.requestedItemId?.number} has ${overdueApprovers.length} pending approver(s)`,
      );
    }
  }
  return { count };
}

function start() {
  cron.schedule("0 9 * * 1-5", async () => {
    try {
      await sendApprovalReminders();
    } catch (e) {
      console.error("[approvalReminder]", e.message);
    }
  });
  console.log("[job] approvalReminder scheduled (weekdays 09:00)");
}

module.exports = { start, sendApprovalReminders };
