/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("./compat");
const UsageLimit = model("usage_limits", { tenant_id: "tenant_id" });
const UsageMeter = model("usage_meters", { tenant_id: "tenant_id" });
module.exports = { UsageLimit, UsageMeter };
