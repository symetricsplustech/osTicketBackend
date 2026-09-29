const { getDB } = require("../config/db");
const Company = require("../models/Company");
const OrganizationUnit = require("../models/OrganizationUnit");
const OrganizationUnitLabel = require("../models/OrganizationUnitLabel");
const ApiError = require("../utils/ApiError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

async function migrateDivisionToBusinessUnit(companyId, { apply = false } = {}) {
  if (!isValidUuid(companyId)) throw new ApiError(422, "Valid tenant ID required");
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, "Tenant not found");

  const filter = { company_id: company._id, type: "division" };
  const [units, legacyLabel] = await Promise.all([
    OrganizationUnit.countDocuments(filter),
    OrganizationUnitLabel.findOne(filter),
  ]);
  const report = { company: String(company._id), units, legacyLabel: Boolean(legacyLabel), applied: false };
  if (!apply || (!units && !legacyLabel)) return report;

  const db = getDB();
  await db.transaction(async (trx) => {
    await trx('organization_unit_labels')
      .insert({ company_id: company._id, type: 'business_unit', label: 'Business Unit' })
      .onConflict(['company_id', 'type'])
      .merge({ label: 'Business Unit' });
    await trx('organization_units')
      .where({ company_id: company._id, type: 'division' })
      .update({ type: 'business_unit' });
    await trx('organization_unit_labels')
      .where(filter)
      .delete();
  });

  return { ...report, applied: true };
}

module.exports = { migrateDivisionToBusinessUnit };
