const Agent = require("../../models/Agent");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");

exports.list = asyncHandler(async (req, res) => {
  const instance = req.params.instanceId;
  const items = await Agent.find({ company_id: instance, is_active: true })
    .sort({ name: 1 });
  res.json({ success: true, items });
});

exports.get = asyncHandler(async (req, res) => {
  const item = await Agent.findById(req.params.agentId);
  if (!item) throw new ApiError(404, "Agent not found");
  res.json({ success: true, item });
});

exports.create = asyncHandler(async (req, res) => {
  const instance = req.params.instanceId;
  const { name, email, password, isAdmin, isActive } = req.body;
  if (!req.body.name || !req.body.name.trim() || !req.body.email || !req.body.password) {
    throw new ApiError(422, "Name, email, and password are required");
  }
  const item = await Agent.create({
    company_id: instance,
    name: req.body.name.trim(),
    email: req.body.email.toLowerCase(),
    password: req.body.password,
    isAdmin: req.body.isAdmin === true,
    is_active: req.body.isActive !== false,
  });
  res.status(201).json({ success: true, item });
});

exports.update = asyncHandler(async (req, res) => {
  const item = await Agent.findById(req.params.agentId);
  if (!item) throw new ApiError(404, "Agent not found");
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new ApiError(422, "Agent name is required");
    item.name = name;
  }
  if (req.body.email !== undefined) item.email = req.body.email.toLowerCase();
  if (req.body.isAdmin !== undefined) item.isAdmin = req.body.isAdmin === true;
  if (req.body.isActive !== undefined) item.is_active = req.body.isActive === true;
  await item.save();
  res.json({ success: true, item });
});

exports.delete = asyncHandler(async (req, res) => {
  const item = await Agent.findById(req.params.agentId);
  if (!item) throw new ApiError(404, "Agent not found");
  await item.deleteOne();
  res.json({ success: true, message: "Agent deleted" });
});