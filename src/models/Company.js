/**
 * PostgreSQL-backed model — compatibility shim with alias fixes.
 * DB column is plan_id but code uses `plan` (and `planId` via camelCase).
 */
const { model } = require("./compat");
module.exports = model("companies", {
  fieldAliases: { plan: "plan_id", planId: "plan_id" },
  instanceMethods: {
    isActive() {
      return this.status === "active" || this.status === "trial";
    },
  },
});
