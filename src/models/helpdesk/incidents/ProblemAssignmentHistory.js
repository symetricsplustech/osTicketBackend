/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
module.exports = model("problem_assignment_histories", {
  company_id: "company_id",
  fieldAliases: { problem: "problem_id" },
});
