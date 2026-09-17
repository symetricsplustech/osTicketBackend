const mongoose = require("mongoose");
const Company = require("../models/Company");
const OrganizationUnit = require("../models/OrganizationUnit");
const OrganizationUnitLabel = require("../models/OrganizationUnitLabel");
const ApiError = require("../utils/ApiError");

async function migrateDivisionToBusinessUnit(companyId, { apply = false } = {}) {
  if (!mongoose.isValidObjectId(companyId)) throw new ApiError(422, "Valid tenant ID required");
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, "Tenant not found");

  const filter = { company: company._id, type: "division" };
  const [units, legacyLabel] = await Promise.all([
    OrganizationUnit.countDocuments(filter),
    OrganizationUnitLabel.findOne(filter),
  ]);
  const report = { company: String(company._id), units, legacyLabel: Boolean(legacyLabel), applied: false };
  if (!apply || (!units && !legacyLabel)) return report;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const canonical = { company: company._id, type: "business_unit" };
      await OrganizationUnitLabel.updateOne(
        canonical,
        { $setOnInsert: { ...canonical, label: "Business Unit" } },
        { upsert: true, session },
      );
      await OrganizationUnit.updateMany(filter, { $set: { type: "business_unit" } }, { session });
      await OrganizationUnitLabel.deleteOne(filter, { session });
    });
  } finally {
    await session.endSession();
  }
  return { ...report, applied: true };
}

module.exports = { migrateDivisionToBusinessUnit };
