const jwt = require('jsonwebtoken');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Agent = require('../models/Agent');
const SuperAdmin = require('../models/SuperAdmin');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const { runWithTenant } = require('./tenantScope');

const signToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) return req.cookies.token;
  if (req.query && req.query.access) return req.query.access;
  return null;
};

const attachActiveCompany = async (principal, req) => {
  const auditDenied = (reason) => {
    try {
      require('../services/audit.service').audit({ company: principal.company || null, actorType: principal.isAdmin !== undefined ? 'agent' : 'user', actor: principal._id, actorName: principal.name, action: 'tenant.access_denied', entityType: 'tenant', entityId: principal.company || principal._id, after: { reason }, source: 'auth', req }).catch(() => {});
    } catch (_) { /* audit must never block authentication */ }
  };
  if (!principal.company) { auditDenied('missing_tenant_membership'); throw new ApiError(403, 'A tenant membership is required for this account'); }
  const company = await Company.findById(principal.company).select('_id status');
  if (!company) { auditDenied('inactive_or_missing_tenant'); throw new ApiError(403, `This tenant is not active (company ${principal.company} not found)`); }
  if (!company.isActive()) { auditDenied('inactive_or_missing_tenant'); throw new ApiError(403, `This tenant is not active (status: ${company.status})`); }
  req.companyId = company._id;
  req.company = company;
};

const protectUser = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Not authorized, please login');
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'Session expired, please login again');
  }
  if (decoded.type !== 'user') throw new ApiError(403, 'Customer access only');
  const user = await User.findById(decoded.id);
  if (!user || user.status !== 'active') throw new ApiError(401, 'Account not found or disabled');
  req.user = user;
  await attachActiveCompany(user, req);
  runWithTenant(req.companyId, next);
});

const optionalUser = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded.type === 'user') {
        const user = await User.findById(decoded.id);
        if (user && user.status === 'active') {
          req.user = user;
          if (user.company) await attachActiveCompany(user, req);
        }
      }
    } catch (err) {
      // ignore invalid optional token
    }
  }
  if (req.companyId) return runWithTenant(req.companyId, next);
  next();
});

const protectAgent = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Not authorized, please login');
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'Session expired, please login again');
  }
  if (decoded.type !== 'agent') throw new ApiError(403, 'Staff access only');
  const agent = await Agent.findById(decoded.id).populate('role');
  if (!agent || !agent.isActive) throw new ApiError(401, 'Account not found or disabled');
  req.agent = agent;
  await attachActiveCompany(agent, req);
  runWithTenant(req.companyId, next);
});

const protectAdmin = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Not authorized, please login');
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'Session expired, please login again');
  }
  if (decoded.type !== 'agent') throw new ApiError(403, 'Staff access only');
  const agent = await Agent.findById(decoded.id).populate('role');
  if (!agent || !agent.isActive) throw new ApiError(401, 'Account not found or disabled');
  if (!agent.isAdmin && !(agent.role && agent.role.isAdmin)) {
    throw new ApiError(403, 'Admin access required');
  }
  req.agent = agent;
  await attachActiveCompany(agent, req);
  runWithTenant(req.companyId, next);
});

const protectTenantPrincipal = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Not authorized, please login');
  let decoded;
  try { decoded = verifyToken(token); } catch (_) { throw new ApiError(401, 'Session expired, please login again'); }
  if (decoded.type === 'user') {
    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') throw new ApiError(401, 'Account not found or disabled');
    req.user = user;
    await attachActiveCompany(user, req);
  } else if (decoded.type === 'agent') {
    const agent = await Agent.findById(decoded.id).populate('role');
    if (!agent || !agent.isActive) throw new ApiError(401, 'Account not found or disabled');
    req.agent = agent;
    req.user = agent;
    await attachActiveCompany(agent, req);
    req.user.tenantId = req.companyId;
  } else if (decoded.type === 'superadmin') {
    const superAdmin = await SuperAdmin.findById(decoded.id);
    if (!superAdmin || !superAdmin.isActive) throw new ApiError(401, 'Account not found or disabled');
    req.superAdmin = superAdmin;
    req.user = superAdmin;
    // Superadmin has no tenant context — skip runWithTenant to avoid setting "undefined"
    return next();
  } else {
    throw new ApiError(403, 'Tenant account access only');
  }
  runWithTenant(req.companyId, next);
});

const protectSuperAdmin = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Not authorized, please login');
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'Session expired, please login again');
  }
  if (decoded.type !== 'superadmin') throw new ApiError(403, 'Super admin access only');
  const superAdmin = await SuperAdmin.findById(decoded.id);
  if (!superAdmin || !superAdmin.isActive) {
    throw new ApiError(401, 'Account not found or disabled');
  }
  if (superAdmin.allowedIps && superAdmin.allowedIps.length) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!superAdmin.allowedIps.includes(ip)) {
      throw new ApiError(403, 'Access denied for this IP address');
    }
  }
  superAdmin.lastLogin = new Date();
  await superAdmin.save();
  req.superAdmin = superAdmin;
  next();
});

/**
 * requirePermission(perm, opts?) — route-level guard backed by the central
 * authorization service. Same signature/behavior as before for existing
 * callers (aggregate-admin bypass preserved as an audited aggregate), plus:
 * explicit DENY precedence, module entitlement, record scope/condition
 * checks. Internal decision reasons are audited, never sent to clients.
 *
 * opts: { module, record: (req)=>record|null, requiredScope, conditions,
 *         fields, audit }
 */
const requirePermission = (perm, opts = {}) =>
  asyncHandler(async (req, res, next) => {
    const principal = req.agent || req.user;
    if (!principal) throw new ApiError(401, 'Not authorized');
    const { authorize } = require('../services/authorization.service');
    const record = typeof opts.record === 'function' ? await opts.record(req) : opts.record;
    const result = await authorize({
      principal,
      permission: perm,
      tenant: req.companyId,
      module: opts.module,
      resource: opts.resource,
      record,
      requiredScope: opts.requiredScope,
      conditions: opts.conditions,
      fields: opts.fields,
      req,
    });
    if (result.decision !== 'ALLOW') throw new ApiError(403, 'You do not have permission for this action');
    req.authz = result;
    next();
  });

/**
 * requireSuperAdminPermission - checks if superadmin has a specific permission.
 * Superadmin must have the permission in their permissions array.
 * Pass an array of permissions; user needs at least one (OR logic).
 */
const requireSuperAdminPermission = (...perms) =>
  asyncHandler(async (req, res, next) => {
    const superAdmin = req.superAdmin;
    if (!superAdmin) throw new ApiError(401, 'Not authorized');
    const userPerms = new Set(superAdmin.permissions || []);
    const hasPermission = perms.some(p => userPerms.has(p));
    if (!hasPermission) throw new ApiError(403, 'You do not have permission for this action');
    next();
  });

const protectTenantAgent = [protectAgent, (req, res, next) => {
  req.user = req.agent;
  req.user.tenantId = req.companyId;
  next();
}];

module.exports = { signToken, verifyToken, protectUser, protectAgent, protectAdmin, protectSuperAdmin, protectTenantAgent, protectTenantPrincipal, optionalUser, requirePermission, requireSuperAdminPermission, attachActiveCompany };
