const OrganizationUnit = require("../models/OrganizationUnit");
const { companyContext } = require("./companyHierarchy.service");
const { runWithTenant } = require("../middleware/tenantScope");
const ApiError = require("../utils/ApiError");

async function assertActiveUnit(instanceId, unitId) {
  if (!unitId) return null;
  return runWithTenant(instanceId, async () => {
    await companyContext(instanceId);
    const unit = await OrganizationUnit.findOne({ _id: unitId, company: instanceId, active: true })
      .populate("instanceCompany", "status");
    if (!unit || unit.instanceCompany?.status !== "active")
      throw new ApiError(422, "Choose an active organization unit in this instance");
    return unit._id;
  });
}

module.exports = { assertActiveUnit };
