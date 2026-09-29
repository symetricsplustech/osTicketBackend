/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses change-service links via `change` / `service` /
 * `impactLevel` / `isActive`; the table stores `_id`-suffixed and snake_case
 * columns.
 */
const { model } = require("../../compat");
module.exports = model("change_services", {
  fieldAliases: {
    company: "company_id",
    change: "change_id",
    service: "service_id",
    impactLevel: "impact_level",
    isActive: "is_active",
  },
});