const OrganizationUnit = require("../models/OrganizationUnit");
const Department = require("../models/Department");
const Team = require("../models/Team");
const ApiError = require("../utils/ApiError");

const linkedRecords = [
  { Model: Department, type: "department", label: "department" },
  { Model: Team, type: "team", label: "team" },
];

async function listRecords(Model, company) {
  return Model.find({ company })
    .populate("organizationUnit", "name type instanceCompany")
    .sort({ name: 1 });
}

async function linkRecord({ Model, type, label, company, recordId, unitId }) {
  const item = await Model.findOne({ _id: recordId, company });
  if (!item) throw new ApiError(404, `${label} not found in this instance`);
  const targetId = unitId || null;
  if (targetId) {
    const unit = await OrganizationUnit.findOne({ _id: targetId, company });
    if (!unit || unit.type !== type)
      throw new ApiError(422, `Choose a ${label} unit in this instance`);
    if (await Model.exists({ company, organizationUnit: unit._id, _id: { $ne: item._id } }))
      throw new ApiError(409, `This organization unit is already linked to a ${label.toLowerCase()}`);
  }
  item.organizationUnit = targetId;
  try {
    await item.save();
  } catch (error) {
    if (error.code === 11000)
      throw new ApiError(409, `This organization unit is already linked to a ${label.toLowerCase()}`);
    throw error;
  }
  return item;
}

async function assertLinkedUnitType(company, unitId, nextType) {
  for (const { Model, type, label } of linkedRecords) {
    if (nextType !== type && await Model.exists({ company, organizationUnit: unitId }))
      throw new ApiError(409, `Unlink the operational ${label} before changing this unit's type`);
  }
}

async function assertUnitUnlinked(company, unitId) {
  for (const { Model, label } of linkedRecords) {
    if (await Model.exists({ company, organizationUnit: unitId }))
      throw new ApiError(409, `Unlink the operational ${label} before deleting this unit`);
  }
}

module.exports = { listRecords, linkRecord, assertLinkedUnitType, assertUnitUnlinked };
