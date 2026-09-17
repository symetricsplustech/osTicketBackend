const OrganizationUnit = require("../../models/OrganizationUnit");
const OrganizationUnitLabel = require("../../models/OrganizationUnitLabel");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const hierarchy = require("../../services/organizationHierarchy.service");
const { companyContext, selectedCompany } = require("../../services/companyHierarchy.service");
const recordLinks = require("../../services/organizationRecordLink.service");

const companyId = (req) => {
  if (!req.companyId) throw new ApiError(400, "Company context required");
  return req.companyId;
};

exports.list = asyncHandler(async (req, res) => {
  const { company } = await companyContext(companyId(req));
  const items = await OrganizationUnit.find({ company })
    .populate("parent", "name type")
    .populate("instanceCompany", "name isPrimary")
    .sort({ type: 1, name: 1 });
  res.json({
    success: true,
    items,
    unitTypes: await hierarchy.listTypes(company),
  });
});

exports.listTypes = asyncHandler(async (req, res) => {
  res.json({ success: true, items: await hierarchy.listTypes(companyId(req)) });
});

exports.createType = asyncHandler(async (req, res) => {
  const company = companyId(req);
  const type = hierarchy.normalizeType(req.body.type);
  const label = String(req.body.label || "").trim();
  if (!hierarchy.validType(type) || !label)
    throw new ApiError(422, "A valid type key and label are required");
  if (await OrganizationUnitLabel.exists({ company, type }))
    throw new ApiError(409, "This organization unit type already exists");
  const item = await OrganizationUnitLabel.create({ company, type, label });
  res.status(201).json({ success: true, item });
});

exports.removeType = asyncHandler(async (req, res) => {
  const company = companyId(req);
  const type = hierarchy.normalizeType(req.params.type);
  if (await OrganizationUnit.exists({ company, type }))
    throw new ApiError(409, "Move or delete units of this type first");
  const item = await OrganizationUnitLabel.findOneAndDelete({ company, type });
  if (!item) throw new ApiError(404, "Organization unit type not found");
  res.json({ success: true });
});

exports.create = asyncHandler(async (req, res) => {
  const context = await companyContext(companyId(req));
  const { company } = context;
  const { name, type, parent, description } = req.body;
  if (!String(name || "").trim()) {
    throw new ApiError(422, "name and a valid unit type are required");
  }
  const resolvedType = await hierarchy.assertType(company, type);
  const instanceCompany = await selectedCompany(context, req.body.instanceCompany);
  await hierarchy.assertParent(company, parent, null, instanceCompany);
  const item = await OrganizationUnit.create({
    name,
    type: resolvedType,
    parent: parent || null,
    description,
    company,
    instanceCompany,
  });
  res.status(201).json({ success: true, item });
});

exports.update = asyncHandler(async (req, res) => {
  const context = await companyContext(companyId(req));
  const { company } = context;
  const item = await OrganizationUnit.findOne({ _id: req.params.id, company });
  if (!item) throw new ApiError(404, "Organization unit not found");
  const instanceCompany = req.body.instanceCompany !== undefined
    ? await selectedCompany(context, req.body.instanceCompany)
    : item.instanceCompany;
  if (req.body.instanceCompany !== undefined && String(instanceCompany || "") !== String(item.instanceCompany || "")) {
    if (await OrganizationUnit.exists({ company, parent: item._id }))
      throw new ApiError(409, "Move child units before changing company");
    item.instanceCompany = instanceCompany;
  }
  for (const key of ["name", "description", "active"]) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }
  if (req.body.parent !== undefined) {
    await hierarchy.assertParent(company, req.body.parent, item._id, instanceCompany);
    item.parent = req.body.parent || null;
  } else if (item.parent && req.body.instanceCompany !== undefined) {
    await hierarchy.assertParent(company, item.parent, item._id, instanceCompany);
  }
  if (req.body.type !== undefined) {
    const nextType = await hierarchy.assertType(company, req.body.type);
    await recordLinks.assertLinkedUnitType(company, item._id, nextType);
    item.type = nextType;
  }
  await item.save();
  res.json({ success: true, item });
});

exports.remove = asyncHandler(async (req, res) => {
  const { company } = await companyContext(companyId(req));
  const item = await OrganizationUnit.findOne({ _id: req.params.id, company });
  if (!item) throw new ApiError(404, "Organization unit not found");
  const children = await OrganizationUnit.countDocuments({
    company,
    parent: item._id,
  });
  if (children)
    throw new ApiError(409, "Move child units before deleting this unit");
  await recordLinks.assertUnitUnlinked(company, item._id);
  await item.deleteOne();
  res.json({ success: true, message: "Organization unit deleted" });
});
