const express = require('express');
const { protectAgent } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');
const CustomPermission = require('../models/CustomPermission');
const CustomRole = require('../models/CustomRole');
const { invalidateTenantCustomAuth, matchCustomPermission, isSaasKey } = require('../services/customAuth.service');
const { evaluateScope, matchConditions } = require('../services/authorization.service');

const router = express.Router();

router.use(protectAgent);
router.use(moduleRequired('settings'));

const actorId = (req) => req.agent?._id || req.user?._id;

const principalFor = (req) => ({
  _id: actorId(req),
  teams: req.agent?.teams || [],
  departments: req.agent?.departments || [],
  role: req.agent?.role || null,
});

const respondError = (res, e) => {
  const code = Number(e.statusCode) || (e.name === 'ValidationError' || e.name === 'CastError' ? 400 : 500);
  res.status(code).json({ success: false, message: e.message });
};

// ------------------------- Custom Permissions -------------------------

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const query = { company: req.companyId };
    if (status !== undefined) {
      if (!['active', 'disabled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be "active" or "disabled"' });
      }
      query.status = status;
    }
    const permissions = await CustomPermission.find(query).sort('-createdAt');
    res.json({ success: true, permissions });
  } catch (e) { respondError(res, e); }
});

router.post('/', async (req, res) => {
  try {
    const { key, name, description, module, resource, action, effect, scope, conditions } = req.body || {};
    if (!key || !name) return res.status(400).json({ success: false, message: 'key and name are required' });
    if (isSaasKey(key)) {
      return res.status(400).json({ success: false, message: 'Permission key cannot use SaaS-level namespaces (saas., platform., superadmin.)' });
    }
    const permission = await CustomPermission.create({
      company: req.companyId,
      key: String(key).trim(),
      name,
      description: description || '',
      module: module || 'itsm',
      resource: resource || '',
      action: action || '',
      effect: effect || 'allow',
      scope: scope || '',
      conditions: Array.isArray(conditions) ? conditions : [],
      createdBy: actorId(req),
    });
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, permission });
  } catch (e) { respondError(res, e); }
});

router.put('/:id', async (req, res) => {
  try {
    const { key, ...rest } = req.body || {};
    const update = { ...rest };
    delete update._id;
    delete update.company;
    if (key !== undefined) {
      if (isSaasKey(key)) {
        return res.status(400).json({ success: false, message: 'Permission key cannot use SaaS-level namespaces (saas., platform., superadmin.)' });
      }
      update.key = String(key).trim();
    }
    update.updatedBy = actorId(req);
    const permission = await CustomPermission.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: update },
      { new: true }
    );
    if (!permission) return res.status(404).json({ success: false, message: 'Custom permission not found' });
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, permission });
  } catch (e) { respondError(res, e); }
});

router.delete('/:id', async (req, res) => {
  try {
    const permission = await CustomPermission.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!permission) return res.status(404).json({ success: false, message: 'Custom permission not found' });
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, message: 'Custom permission deleted' });
  } catch (e) { respondError(res, e); }
});

router.post('/:id/test', async (req, res) => {
  try {
    const { permissionKey, sampleRecord } = req.body || {};
    if (!permissionKey) return res.status(400).json({ success: false, message: 'permissionKey is required' });
    const permission = await CustomPermission.findOne({ _id: req.params.id, company: req.companyId });
    if (!permission) return res.status(404).json({ success: false, message: 'Custom permission not found' });
    if (!matchCustomPermission(permission, permissionKey)) {
      return res.json({ success: true, matches: false, via: 'no_match' });
    }
    const via = permission.key === permissionKey ? 'key_match' : 'triple_match';
    if (permission.scope && sampleRecord !== undefined) {
      const ok = evaluateScope(principalFor(req), permission.scope, sampleRecord, req.companyId);
      if (!ok) return res.json({ success: true, matches: false, via: `${via}:scope_rejected` });
    }
    if (Array.isArray(permission.conditions) && permission.conditions.length && sampleRecord !== undefined) {
      const ok = matchConditions(principalFor(req), sampleRecord, permission.conditions, req.companyId);
      if (!ok.ok) return res.json({ success: true, matches: false, via: `${via}:condition_rejected` });
    }
    res.json({ success: true, matches: true, via });
  } catch (e) { respondError(res, e); }
});

// ------------------------- Custom Roles -------------------------

router.get('/roles', async (req, res) => {
  try {
    const roles = await CustomRole.find({ company: req.companyId }).sort('-createdAt');
    res.json({ success: true, roles });
  } catch (e) { respondError(res, e); }
});

router.post('/roles', async (req, res) => {
  try {
    const { key, name, description, module, permissions, deniedPermissions, recordScopes, fieldAccess, agentMembers, teamMembers, effectiveFrom, effectiveUntil } = req.body || {};
    if (!key || !name) return res.status(400).json({ success: false, message: 'key and name are required' });
    if (Array.isArray(permissions) && permissions.some((p) => isSaasKey(p))) {
      return res.status(400).json({ success: false, message: 'Custom roles cannot grant SaaS permissions' });
    }
    const role = await CustomRole.create({
      company: req.companyId,
      key: String(key).trim(),
      name,
      description: description || '',
      module: module || 'itsm',
      permissions: Array.isArray(permissions) ? permissions : [],
      deniedPermissions: Array.isArray(deniedPermissions) ? deniedPermissions : [],
      recordScopes: Array.isArray(recordScopes) ? recordScopes : [],
      fieldAccess: Array.isArray(fieldAccess) ? fieldAccess : [],
      agentMembers: Array.isArray(agentMembers) ? agentMembers : [],
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
      effectiveFrom: effectiveFrom || null,
      effectiveUntil: effectiveUntil || null,
      createdBy: actorId(req),
    });
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, role });
  } catch (e) { respondError(res, e); }
});

router.put('/roles/:id', async (req, res) => {
  try {
    const { key, permissions, ...rest } = req.body || {};
    const update = { ...rest };
    delete update._id;
    delete update.company;
    if (key !== undefined) update.key = String(key).trim();
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.some((p) => isSaasKey(p))) {
        return res.status(400).json({ success: false, message: 'Custom roles cannot grant SaaS permissions' });
      }
      update.permissions = permissions;
    }
    update.updatedBy = actorId(req);
    const role = await CustomRole.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: update },
      { new: true }
    );
    if (!role) return res.status(404).json({ success: false, message: 'Custom role not found' });
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, role });
  } catch (e) { respondError(res, e); }
});

router.delete('/roles/:id', async (req, res) => {
  try {
    const role = await CustomRole.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!role) return res.status(404).json({ success: false, message: 'Custom role not found' });
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, message: 'Custom role deleted' });
  } catch (e) { respondError(res, e); }
});

router.post('/roles/:id/members', async (req, res) => {
  try {
    const { agentIds = [], teamIds = [] } = req.body || {};
    if (!Array.isArray(agentIds) || !Array.isArray(teamIds)) {
      return res.status(400).json({ success: false, message: 'agentIds and teamIds must be arrays' });
    }
    const role = await CustomRole.findOne({ _id: req.params.id, company: req.companyId });
    if (!role) return res.status(404).json({ success: false, message: 'Custom role not found' });
    const addAgents = [ ...new Set([...(role.agentMembers || []).map(String), ...agentIds.filter((id) => id).map(String)]) ];
    const addTeams = [ ...new Set([...(role.teamMembers || []).map(String), ...teamIds.filter((id) => id).map(String)]) ];
    role.agentMembers = addAgents;
    role.teamMembers = addTeams;
    role.updatedBy = actorId(req);
    await role.save();
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, role });
  } catch (e) { respondError(res, e); }
});

router.delete('/roles/:id/members', async (req, res) => {
  try {
    const { agentIds = [], teamIds = [] } = req.body || {};
    if (!Array.isArray(agentIds) || !Array.isArray(teamIds)) {
      return res.status(400).json({ success: false, message: 'agentIds and teamIds must be arrays' });
    }
    const role = await CustomRole.findOne({ _id: req.params.id, company: req.companyId });
    if (!role) return res.status(404).json({ success: false, message: 'Custom role not found' });
    const removeAgents = new Set(agentIds.filter((id) => id).map(String));
    const removeTeams = new Set(teamIds.filter((id) => id).map(String));
    role.agentMembers = (role.agentMembers || []).filter((m) => !removeAgents.has(String(m)));
    role.teamMembers = (role.teamMembers || []).filter((m) => !removeTeams.has(String(m)));
    role.updatedBy = actorId(req);
    await role.save();
    invalidateTenantCustomAuth(req.companyId);
    res.json({ success: true, role });
  } catch (e) { respondError(res, e); }
});

module.exports = router;