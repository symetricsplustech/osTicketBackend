/**
 * Guards against cross-tenant references when linking related records.
 * Every relationship endpoint must verify that the target record belongs to
 * the same tenant before creating the link; otherwise a client could cross
 * tenant boundaries by supplying a foreign primary key.
 */
const ApiError = require("../utils/ApiError");

const notFound = (label) =>
  new ApiError(404, `${label} not found`);

const crossTenant = (label) =>
  new ApiError(403, `Cannot link a ${label} that belongs to another tenant`);

async function assertTenantOf(model, id, tenantId, label) {
  if (id === undefined || id === null || id === "") {
    throw new ApiError(400, `${label} id is required`);
  }
  const record = await model.findOne({ _id: id });
  if (!record) throw notFound(label);
  const recordTenant = record.tenantId ?? record.company;
  if (!recordTenant || String(recordTenant) !== String(tenantId)) {
    throw crossTenant(label);
  }
  return record;
}

module.exports = { assertTenantOf };