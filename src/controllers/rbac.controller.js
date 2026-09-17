const OrganizationUnit = require("../models/OrganizationUnit");
const OrganizationUnitLabel = require("../models/OrganizationUnitLabel");
const Department = require("../models/Department");
const AccessAssignment = require("../models/AccessAssignment");
const Role = require("../models/Role");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { canGrant } = require("../services/rbac.service");
const { audit } = require("../services/audit.service");
const hierarchy = require("../services/organizationHierarchy.service");
const { companyContext, selectedCompany } = require("../services/companyHierarchy.service");

const unitScope = (req) => ({ company: req.companyId });
const companyScope = (req) => ({ company: req.companyId, scope: "tenant" });
const scopedRoles = async (ids, req) => {
  const roles = await Role.find({
    _id: { $in: ids || [] },
    ...companyScope(req),
  });
  if (roles.length !== (ids || []).length)
    throw new ApiError(
      422,
      "One or more roles do not belong to this organisation",
    );
  return roles;
};

exports.listUnits = asyncHandler(async (req, res) => {
  await companyContext(req.companyId);
  const items = await OrganizationUnit.find(unitScope(req)).sort({
    type: 1,
    name: 1,
  });
  res.json({ success: true, items, unitTypes: await hierarchy.listTypes(req.companyId) });
});

exports.getUnitTree = asyncHandler(async (req, res) => {
  await companyContext(req.companyId);
  const items = await OrganizationUnit.find(unitScope(req)).sort({ name: 1 });
  const byId = new Map(
    items.map((item) => [
      String(item._id),
      { ...item.toObject(), children: [] },
    ]),
  );
  const roots = [];
  for (const item of byId.values()) {
    const parent = item.parent ? byId.get(String(item.parent)) : null;
    if (parent && parent._id !== item._id) parent.children.push(item);
    else roots.push(item);
  }
  res.json({
    success: true,
    items: roots,
    unitTypes: await hierarchy.listTypes(req.companyId),
  });
});

exports.listUnitLabels = asyncHandler(async (req, res) => {
  const items = await OrganizationUnitLabel.find(unitScope(req)).sort({
    type: 1,
  });
  res.json({ success: true, items, unitTypes: await hierarchy.listTypes(req.companyId) });
});

exports.updateUnitLabel = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const label = String(req.body.label || "").trim();
  if (!hierarchy.validType(type))
    throw new ApiError(422, "Invalid organisation unit type key");
  if (!label) throw new ApiError(422, "A display label is required");
  const before = await OrganizationUnitLabel.findOne({
    ...unitScope(req),
    type,
  });
  const item = await OrganizationUnitLabel.findOneAndUpdate(
    { ...unitScope(req), type },
    { $set: { label }, $setOnInsert: { company: req.companyId, type } },
    { new: true, upsert: true, runValidators: true },
  );
  auditUnit(
    req,
    "organization_unit_label.updated",
    item,
    before?.toObject() || null,
  );
  res.json({ success: true, item });
});

const auditUnit = (req, action, item, before = null, reason = "") =>
  audit({
    company: req.companyId,
    actorType: "agent",
    actor: req.agent?._id,
    actorName: req.agent?.name || "",
    action,
    entityType: "organization_unit",
    entityId: item?._id || null,
    before,
    after: item?.toObject ? item.toObject() : item,
    reason,
    source: "rbac.units",
    req,
  });

exports.createUnit = asyncHandler(async (req, res) => {
  const { name, type, label, parent, metadata } = req.body;
  if (!name || !type) throw new ApiError(422, "Name and type are required");
  const context = await companyContext(req.companyId);
  const instanceCompany = await selectedCompany(context, req.body.instanceCompany);
  const resolvedType = await hierarchy.assertType(req.companyId, type);
  await hierarchy.assertParent(req.companyId, parent, null, instanceCompany);
  const item = await OrganizationUnit.create({
    name,
    type: resolvedType,
    label: label || "",
    parent: parent || null,
    metadata: metadata || {},
    company: req.companyId,
    instanceCompany,
  });
  auditUnit(req, "organization_unit.created", item);
  res.status(201).json({ success: true, item });
});
exports.updateUnit = asyncHandler(async (req, res) => {
  const context = await companyContext(req.companyId);
  const item = await OrganizationUnit.findOne({
    _id: req.params.id,
    ...unitScope(req),
  });
  if (!item) throw new ApiError(404, "Organisation unit not found");
  const before = item.toObject();
  const instanceCompany = req.body.instanceCompany !== undefined
    ? await selectedCompany(context, req.body.instanceCompany)
    : item.instanceCompany;
  if (req.body.instanceCompany !== undefined && String(instanceCompany || "") !== String(item.instanceCompany || "")) {
    if (await OrganizationUnit.exists({ company: req.companyId, parent: item._id }))
      throw new ApiError(409, "Move child units before changing company");
    item.instanceCompany = instanceCompany;
  }
  if (req.body.parent !== undefined)
    await hierarchy.assertParent(req.companyId, req.body.parent, item._id, instanceCompany);
  else if (item.parent && req.body.instanceCompany !== undefined)
    await hierarchy.assertParent(req.companyId, item.parent, item._id, instanceCompany);
  if (req.body.type !== undefined) {
    req.body.type = await hierarchy.assertType(req.companyId, req.body.type);
    if (req.body.type !== "department" && await Department.exists({
      company: req.companyId, organizationUnit: item._id,
    })) throw new ApiError(409, "Unlink the operational department before changing this unit's type");
  }
  ["name", "type", "label", "parent", "status", "metadata"].forEach((key) => {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  });
  try {
    await item.save();
  } catch (error) {
    auditUnit(
      req,
      "organization_unit.update_denied",
      { _id: item._id, ...req.body },
      before,
      error.message,
    );
    throw new ApiError(422, error.message);
  }
  auditUnit(req, "organization_unit.updated", item, before);
  res.json({ success: true, item });
});

exports.listAssignments = asyncHandler(async (req, res) => {
  const items = await AccessAssignment.find(companyScope(req))
    .populate("roles", "name category moduleKeys recordScopes")
    .populate("unitScopes", "name type")
    .populate("departmentScopes", "name")
    .populate("locationScopes", "name type")
    .populate("teamScopes", "name")
    .sort({ createdAt: -1 });
  res.json({ success: true, items });
});
exports.createAssignment = asyncHandler(async (req, res) => {
  const {
    principal,
    principalType,
    roles: roleIds,
    unitScopes = [],
    departmentScopes = [],
    locationScopes = [],
    teamScopes = [],
    moduleKeys = [],
    startsAt,
    expiresAt,
  } = req.body;
  if (
    !principal ||
    !principalType ||
    !Array.isArray(roleIds) ||
    !roleIds.length
  )
    throw new ApiError(
      422,
      "Principal, principal type, and at least one role are required",
    );
  const roles = await scopedRoles(roleIds, req);
  if (!(await canGrant(req.agent, roles)))
    throw new ApiError(403, "You cannot grant one or more requested roles");
  const item = await AccessAssignment.create({
    company: req.companyId,
    principal,
    principalType,
    roles: roleIds,
    unitScopes,
    departmentScopes,
    locationScopes,
    teamScopes,
    moduleKeys,
    startsAt: startsAt || new Date(),
    expiresAt: expiresAt || null,
    grantedBy: req.agent._id,
  });
  res.status(201).json({ success: true, item });
});
exports.updateAssignment = asyncHandler(async (req, res) => {
  const item = await AccessAssignment.findOne({
    _id: req.params.id,
    ...companyScope(req),
  });
  if (!item) throw new ApiError(404, "Access assignment not found");
  if (req.body.roles) {
    const roles = await scopedRoles(req.body.roles, req);
    if (!(await canGrant(req.agent, roles)))
      throw new ApiError(403, "You cannot grant one or more requested roles");
  }
  [
    "roles",
    "unitScopes",
    "departmentScopes",
    "locationScopes",
    "teamScopes",
    "moduleKeys",
    "startsAt",
    "expiresAt",
    "active",
  ].forEach((key) => {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  });
  await item.save();
  res.json({ success: true, item });
});
