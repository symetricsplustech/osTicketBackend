const OrganizationUnit = require('../models/OrganizationUnit');
const OrganizationUnitLabel = require('../models/OrganizationUnitLabel');
const AccessAssignment = require('../models/AccessAssignment');
const Role = require('../models/Role');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { canGrant } = require('../services/rbac.service');
const { audit } = require('../services/audit.service');

const unitScope = (req) => ({ company: req.companyId });
const companyScope = (req) => ({ company: req.companyId, scope: 'tenant' });
const scopedRoles = async (ids, req) => {
  const roles = await Role.find({ _id: { $in: ids || [] }, ...companyScope(req) });
  if (roles.length !== (ids || []).length) throw new ApiError(422, 'One or more roles do not belong to this organisation');
  return roles;
};

exports.listUnits = asyncHandler(async (req, res) => {
  const items = await OrganizationUnit.find(unitScope(req)).sort({ type: 1, name: 1 });
  res.json({ success: true, items, unitTypes: OrganizationUnit.UNIT_TYPES });
});

exports.getUnitTree = asyncHandler(async (req, res) => {
  const items = await OrganizationUnit.find(unitScope(req)).sort({ name: 1 });
  const byId = new Map(items.map((item) => [String(item._id), { ...item.toObject(), children: [] }]));
  const roots = [];
  for (const item of byId.values()) {
    const parent = item.parent ? byId.get(String(item.parent)) : null;
    if (parent && parent._id !== item._id) parent.children.push(item);
    else roots.push(item);
  }
  res.json({ success: true, items: roots, unitTypes: OrganizationUnit.UNIT_TYPES });
});

exports.listUnitLabels = asyncHandler(async (req, res) => {
  const items = await OrganizationUnitLabel.find(unitScope(req)).sort({ type: 1 });
  res.json({ success: true, items, unitTypes: OrganizationUnit.UNIT_TYPES });
});

exports.updateUnitLabel = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const label = String(req.body.label || '').trim();
  if (!OrganizationUnit.UNIT_TYPES.includes(type)) throw new ApiError(422, 'Unknown organisation unit type');
  if (!label) throw new ApiError(422, 'A display label is required');
  const before = await OrganizationUnitLabel.findOne({ ...unitScope(req), type });
  const item = await OrganizationUnitLabel.findOneAndUpdate(
    { ...unitScope(req), type },
    { $set: { label }, $setOnInsert: { company: req.companyId, type } },
    { new: true, upsert: true, runValidators: true }
  );
  auditUnit(req, 'organization_unit_label.updated', item, before?.toObject() || null);
  res.json({ success: true, item });
});

const auditUnit = (req, action, item, before = null, reason = '') => audit({
  company: req.companyId,
  actorType: 'agent',
  actor: req.agent?._id,
  actorName: req.agent?.name || '',
  action,
  entityType: 'organization_unit',
  entityId: item?._id || null,
  before,
  after: item?.toObject ? item.toObject() : item,
  reason,
  source: 'rbac.units',
  req,
});

const validateParent = async (req, parent, itemId = null) => {
  if (!parent) return null;
  if (itemId && String(parent) === String(itemId)) throw new ApiError(422, 'An organisation unit cannot be its own parent');
  const parentUnit = await OrganizationUnit.findOne({ _id: parent, ...unitScope(req) });
  if (!parentUnit) throw new ApiError(422, 'Parent unit not found in this tenant');
  const visited = new Set(itemId ? [String(itemId)] : []);
  let cursor = parentUnit;
  while (cursor) {
    const id = String(cursor._id);
    if (visited.has(id)) throw new ApiError(422, 'Organisation hierarchy cannot contain a cycle');
    visited.add(id);
    cursor = cursor.parent ? await OrganizationUnit.findOne({ _id: cursor.parent, ...unitScope(req) }) : null;
  }
  return parentUnit;
};

exports.createUnit = asyncHandler(async (req, res) => {
  const { name, type, label, parent, metadata } = req.body;
  if (!name || !type) throw new ApiError(422, 'Name and type are required');
  await validateParent(req, parent);
  const item = await OrganizationUnit.create({ name, type, label: label || '', parent: parent || null, metadata: metadata || {}, company: req.companyId });
  auditUnit(req, 'organization_unit.created', item);
  res.status(201).json({ success: true, item });
});
exports.updateUnit = asyncHandler(async (req, res) => {
  const item = await OrganizationUnit.findOne({ _id: req.params.id, ...unitScope(req) });
  if (!item) throw new ApiError(404, 'Organisation unit not found');
  const before = item.toObject();
  if (req.body.parent !== undefined) await validateParent(req, req.body.parent, item._id);
  ['name', 'type', 'label', 'parent', 'status', 'metadata'].forEach((key) => { if (req.body[key] !== undefined) item[key] = req.body[key]; });
  try { await item.save(); } catch (error) {
    auditUnit(req, 'organization_unit.update_denied', { _id: item._id, ...req.body }, before, error.message);
    throw new ApiError(422, error.message);
  }
  auditUnit(req, 'organization_unit.updated', item, before);
  res.json({ success: true, item });
});

exports.listAssignments = asyncHandler(async (req, res) => {
  const items = await AccessAssignment.find(companyScope(req)).populate('roles', 'name category moduleKeys recordScopes').populate('unitScopes', 'name type').populate('departmentScopes', 'name').populate('locationScopes', 'name type').populate('teamScopes', 'name').sort({ createdAt: -1 });
  res.json({ success: true, items });
});
exports.createAssignment = asyncHandler(async (req, res) => {
  const { principal, principalType, roles: roleIds, unitScopes = [], departmentScopes = [], locationScopes = [], teamScopes = [], moduleKeys = [], startsAt, expiresAt } = req.body;
  if (!principal || !principalType || !Array.isArray(roleIds) || !roleIds.length) throw new ApiError(422, 'Principal, principal type, and at least one role are required');
  const roles = await scopedRoles(roleIds, req);
  if (!(await canGrant(req.agent, roles))) throw new ApiError(403, 'You cannot grant one or more requested roles');
  const item = await AccessAssignment.create({ company: req.companyId, principal, principalType, roles: roleIds, unitScopes, departmentScopes, locationScopes, teamScopes, moduleKeys, startsAt: startsAt || new Date(), expiresAt: expiresAt || null, grantedBy: req.agent._id });
  res.status(201).json({ success: true, item });
});
exports.updateAssignment = asyncHandler(async (req, res) => {
  const item = await AccessAssignment.findOne({ _id: req.params.id, ...companyScope(req) });
  if (!item) throw new ApiError(404, 'Access assignment not found');
  if (req.body.roles) {
    const roles = await scopedRoles(req.body.roles, req);
    if (!(await canGrant(req.agent, roles))) throw new ApiError(403, 'You cannot grant one or more requested roles');
  }
  ['roles', 'unitScopes', 'departmentScopes', 'locationScopes', 'teamScopes', 'moduleKeys', 'startsAt', 'expiresAt', 'active'].forEach((key) => { if (req.body[key] !== undefined) item[key] = req.body[key]; });
  await item.save(); res.json({ success: true, item });
});
