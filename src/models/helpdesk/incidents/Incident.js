/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
const repo = model("incidents", { company_id: "company_id" });

repo.IMPACT_URGENCY_PRIORITY = {
  low: { low: "Low", medium: "Low", high: "Normal" },
  medium: { low: "Low", medium: "Normal", high: "High" },
  high: { low: "Normal", medium: "High", high: "Emergency" },
};

repo.calculatePriority = (impact, urgency) => {
  return repo.IMPACT_URGENCY_PRIORITY[impact]?.[urgency] || "Normal";
};

module.exports = repo;
