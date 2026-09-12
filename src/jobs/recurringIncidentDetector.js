/**
 * Detect recurring incidents and suggest problem creation.
 * Runs every 30 minutes.
 */
const Incident = require("../models/helpdesk/incidents/Incident");
const Problem = require("../models/helpdesk/incidents/Problem");
const events = require("../services/events");

const RECURRENCE_THRESHOLD = 3;
const BATCH_SIZE = 100;

async function detectRecurringIncidents() {
  const incidents = await Incident.find({
    isActive: true,
    status: { $nin: ["closed", "canceled"] },
  }).limit(BATCH_SIZE);

  const byCategory = {};
  for (const inc of incidents) {
    if (!inc.category) continue;
    const key = `${inc.category}|${inc.subcategory || ""}`;
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(inc);
  }

  let suggested = 0;

  for (const [key, incs] of Object.entries(byCategory)) {
    if (incs.length < RECURRENCE_THRESHOLD) continue;

    const existingProblem = await Problem.findOne({
      category: incs[0].category,
      subcategory: incs[0].subcategory,
      isActive: true,
      status: { $nin: ["closed", "canceled"] },
    });

    if (!existingProblem) {
      events.emit("problem.suggested", {
        category: incs[0].category,
        subcategory: incs[0].subcategory,
        incidentCount: incs.length,
        incidentIds: incs.map((i) => i._id),
      });
      suggested++;
    }
  }

  return { evaluated: incidents.length, suggested };
}

module.exports = { detectRecurringIncidents };
