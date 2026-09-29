const Department = require("../../models/Department");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const links = require("../../services/organizationRecordLink.service");

exports.list = asyncHandler(async (req, res) => {
  const items = await links.listRecords(Department, req.params.instanceId);
  res.json({ success: true, items });
});

exports.create = asyncHandler(async (req, res) => {
  const instance = req.params.instanceId;
  const item = await Department.create({
    name: req.body.name,
    company_id: instance,
    is_active: req.body.status === "active",
  });
  res.status(201).json({ success: true, item });
});

exports.get = asyncHandler(async (req, res) => {
  const item = await Department.findById(req.params.departmentId);
  if (!item) throw new ApiError(404, "Department not found");
  res.json({ success: true, item });
});

exports.update = asyncHandler(async (req, res) => {
  const item = await Department.findById(req.params.departmentId);
  if (!item) throw new ApiError(404, "Department not found");
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new ApiError(422, "Department name is required");
    item.name = name;
  }
  if (req.body.status !== undefined) {
    if (!["active", "inactive"].includes(req.body.status))
      throw new ApiError(422, "Invalid department status");
    item.is_active = req.body.status === "active";
  }
  await item.save();
  res.json({ success: true, item });
});

exports.linkUnit = asyncHandler(async (req, res) => {
  const item = await links.linkRecord({
    Model: Department, type: "department", label: "Department",
    company: req.params.instanceId, recordId: req.params.departmentId,
    unitId: req.body.organizationUnit,
  });
  res.json({ success: true, item });
});

exports.delete = asyncHandler(async (req, res) => {
  const item = await Department.findById(req.params.departmentId);
  if (!item) throw new ApiError(404, "Department not found");
  await item.deleteOne();
  res.json({ success: true, message: "Department deleted" });
});
