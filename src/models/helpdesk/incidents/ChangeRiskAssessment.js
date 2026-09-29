/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The risk assessment service addresses rows via `change` / `overallRisk`;
 * the table stores `_id`-suffixed and snake_case columns.
 */
const { model } = require("../../compat");
module.exports = model("change_risk_assessments", {
  fieldAliases: {
    company: "company_id",
    change: "change_id",
    overallRisk: "overall_risk",
  },
});