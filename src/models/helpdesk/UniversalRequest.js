const { model } = require("../compat");

module.exports = model("universal_requests", {
  tenantField: "tenant_id",
  jsonColumns: ["metadata"],
});
