const Department = require("../../models/Department");
const OrganizationUnit = require("../../models/OrganizationUnit");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");

exports.list = asyncHandler(async (req, res) => {
  const items = await Department.find({ company: req.params.instanceId })
    .populate("organizationUnit", "name type instanceCompany")
    .sort({ name: 1 });
  res.json({ success: true, items });
});

exports.linkUnit = asyncHandler(async (req, res) => {
  const company = req.params.instanceId;
  const item = await Department.findOne({ _id: req.params.departmentId, company });
  if (!item) throw new ApiError(404, "Department not found in this instance");

  const unitId = req.body.organizationUnit || null;
  if (unitId) {
    const unit = await OrganizationUnit.findOne({ _id: unitId, company });
    if (!unit || unit.type !== "department")
      throw new ApiError(422, "Choose a Department unit in this instance");
    if (await Department.exists({ company, organizationUnit: unit._id, _id: { $ne: item._id } }))
      throw new ApiError(409, "This organization unit is already linked to a department");
  }
  item.organizationUnit = unitId;
  try {
    await item.save();
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "This organization unit is already linked to a department");
    throw error;
  }
  res.json({ success: true, item });
});
