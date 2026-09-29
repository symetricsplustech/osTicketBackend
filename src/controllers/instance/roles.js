const Role = require("../../models/Role");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");

exports.list = asyncHandler(async (req, res) => {
  const instance = req.params.instanceId;
  const items = await Role.find({ company_id: instance, status: "active" })
    .sort({ name: 1 });
  res.json({ success: true, items });
});

exports.get = asyncHandler(async (req, res) => {
  const item = await Role.findById(req.params.roleId);
  if (!item) throw new ApiError(404, "Role not found");
  res.json({ success: true, item });
});

exports.create = asyncHandler(async (req, res) => {
  const instance = req.params.instanceId;
  const { name, description, permissions, isActive } = req.body;
  if (!req.body.name || !req.body.name.trim()) {
    throw new ApiError(422, "Role name is required");
  }
  const item = await Role.create({
    company_id: instance,
    name: req.body.name.trim(),
    description: req.body.description || "",
    permissions: req.body.permissions || [],
    status: req.body.isActive === false ? "disabled" : "active",
  });
  res.status(201).json({ success: true, item });
});

exports.update = asyncHandler(async (req, res) => {
  const item = await Role.findById(req.params.roleId);
  if (!item) throw new ApiError(404, "Role not found");
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new ApiError(422, "Role name is required");
    item.name = name;
  }
  if (req.body.description !== undefined) item.description = req.body.description;
  if (req.body.permissions !== undefined) item.permissions = req.body.permissions;
  if (req.body.isActive !== undefined) item.status = req.body.isActive ? "active" : "disabled";
  await item.save();
  res.json({ success: true, item });
});

exports.delete = asyncHandler(async (req, res) => {
  const item = await Role.findById(req.params.roleId);
  if (!item) throw new ApiError(404, "Role not found");
  await item.deleteOne();
  res.json({ success: true, message: "Role deleted" });
});