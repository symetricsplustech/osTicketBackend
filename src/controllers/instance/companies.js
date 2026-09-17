const Company = require("../../models/Company");
const InstanceCompany = require("../../models/InstanceCompany");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const { activeMembership } = require("../../services/instanceAccess.service");
const { ensurePrimaryCompany, nameKey } = require("../../services/companyHierarchy.service");

async function adminInstance(req) {
  const id = req.params.instanceId;
  const membership = req.user && !req.agent && activeMembership(req.user, id);
  if (!membership || !["instance_owner", "instance_admin"].includes(membership.role) ||
      req.companyId && String(req.companyId) !== id)
    throw new ApiError(403, "Active instance admin membership required");
  const instance = await Company.findOne({ _id: id, isInstance: true });
  if (!instance || !instance.isActive()) throw new ApiError(404, "Active instance not found");
  await ensurePrimaryCompany(instance);
  return instance;
}

exports.list = asyncHandler(async (req, res) => {
  const instance = await adminInstance(req);
  const items = await InstanceCompany.find({ tenantId: instance._id })
    .sort({ isPrimary: -1, name: 1 });
  res.json({ success: true, items });
});

exports.create = asyncHandler(async (req, res) => {
  const instance = await adminInstance(req);
  const name = String(req.body.name || "").trim();
  if (!name) throw new ApiError(422, "Company name is required");
  try {
    const item = await InstanceCompany.create({
      tenantId: instance._id, name, nameKey: nameKey(name),
      domain: req.body.domain || "", email: req.body.email || "",
      phone: req.body.phone || "", address: req.body.address || "",
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "Company name already exists in this instance");
    throw error;
  }
});

exports.update = asyncHandler(async (req, res) => {
  const instance = await adminInstance(req);
  const item = await InstanceCompany.findOne({ _id: req.params.companyId, tenantId: instance._id });
  if (!item) throw new ApiError(404, "Company not found");
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new ApiError(422, "Company name is required");
    item.name = name;
    item.nameKey = nameKey(name);
  }
  for (const field of ["domain", "email", "phone", "address"])
    if (req.body[field] !== undefined) item[field] = req.body[field];
  if (req.body.status !== undefined) {
    if (!["active", "inactive"].includes(req.body.status))
      throw new ApiError(422, "Invalid company status");
    if (item.isPrimary && req.body.status !== "active")
      throw new ApiError(409, "Primary company cannot be disabled");
    item.status = req.body.status;
  }
  try {
    await item.save();
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "Company name already exists in this instance");
    throw error;
  }
  res.json({ success: true, item });
});
