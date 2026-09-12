/**
 * Problem SLA escalation check.
 * Runs every 15 minutes.
 */
const Problem = require("../models/helpdesk/incidents/Problem");
const events = require("../services/events");
const auditEventService = require("../services/auditEventService");

const BATCH_SIZE = 50;

async function checkProblemSlas() {
  const problems = await Problem.find({
    status: { $nin: ["resolved", "closed", "canceled"] },
    isActive: true,
  }).limit(BATCH_SIZE);

  let escalated = 0;
  const now = new Date();

  for (const problem of problems) {
    const ageHours = (now.getTime() - problem.createdAt.getTime()) / 3600000;

    if (ageHours > 168 && problem.priority !== "Emergency") {
      problem.priority = "Emergency";
      problem.timeline.push({
        at: now,
        by: "system",
        message: "Auto-escalated to Emergency after 7 days",
      });
      await problem.save();
      escalated++;
    } else if (ageHours > 72 && problem.priority === "Low") {
      problem.priority = "Normal";
      problem.timeline.push({
        at: now,
        by: "system",
        message: "Auto-escalated to Normal after 3 days",
      });
      await problem.save();
      escalated++;
    }
  }

  return { evaluated: problems.length, escalated };
}

module.exports = { checkProblemSlas };
