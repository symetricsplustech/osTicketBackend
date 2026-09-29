/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model, STATUSES } = require("../../compat");
const repo = model("tickets", { tenantField: "company_id", fieldAliases: { contract: "contract_id" } });
repo.STATUSES = STATUSES;
module.exports = repo;
