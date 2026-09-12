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

const assertSessionVersion = (decoded, principal) => {
  const tokenVersion = Number(decoded.sv || 0);
  const currentVersion = Number(principal.sessionVersion || 0);
  if (tokenVersion !== currentVersion) throw new ApiError(401, 'Session has been revoked, please login again');
};

const attachPrivilegedSession = async (decoded, req) => {
  if (!decoded.sid) return;
  const PrivilegedSession = require('../models/PrivilegedSession');
  const session = await PrivilegedSession.findOne({ sessionId: decoded.sid });
  if (!session || session.status !== 'active' || session.expiresAt < new Date()) {
    if (session && session.status === 'active') {
      session.status = 'expired';
      await session.save().catch(() => {});
    }
    throw new ApiError(401, 'Privileged session expired or revoked');
  }
  req.privilegedSession = session;
  if (!req._privilegedAuditAttached) {
    req._privilegedAuditAttached = true;
    const startedAt = Date.now();
    resFinishAudit(req, session, startedAt);
  }
};

const resFinishAudit = (req, session, startedAt) => {
  const res = req.res;
  if (!res) return;
  res.once('finish', () => {
    require('../services/audit.service').audit({
      company: session.targetTenant,
      actorType: 'agent',
      actor: session.effectiveActor,
      actorName: session.targetUser,
      action: `privileged.${req.method.toLowerCase()}`,
      entityType: 'http_request',
      entityId: null,
      after: { path: req.originalUrl, statusCode: res.statusCode, durationMs: Date.now() - startedAt },
      reason: session.reason,
      source: 'privileged-session',
      req,
    });
  });
};

/**
 * Idle-session timeout + IP allowlist, evaluated on every authenticated
 * request (settings.auth.sessionTimeoutMinutes, 0 = off; allowlist empty =
 * no restriction). Activity touch is throttled to one write per 5 minutes.
 */
const touchSession = async (doc, req) => {
  try {
    const SystemSetting = require('../models/SystemSetting');
    const settings = await SystemSetting.getSettings();
    const timeoutMin = Number(settings.auth?.sessionTimeoutMinutes) || 0;
    const now = Date.now();
    const last = doc.lastSeenAt ? new Date(doc.lastSeenAt).getTime() : 0;
    if (timeoutMin > 0 && last && now - last > timeoutMin * 60 * 1000) {
      throw new ApiError(401, 'Session expired due to inactivity, please login again');
    }
    if (!last || now - last > 5 * 60 * 1000) {
      await doc.constructor.updateOne({ _id: doc._id }, { $set: { lastSeenAt: new Date() } });
    }
  } catch (err) {
    if (err && err.statusCode) throw err;
    // session bookkeeping must never block authentication
  }
  await require('./ipAllowlist').enforceIpAllowlist(req);
};

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
  const user = await User.findById(decoded.id).select('+sessionVersion');
  if (!user || user.status !== 'active') throw new ApiError(401, 'Account not found or disabled');
  assertSessionVersion(decoded, user);
  req.user = user;
  await attachActiveCompany(user, req);
  await touchSession(user, req);
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
  const agent = await Agent.findById(decoded.id).select('+sessionVersion').populate('role');
  if (!agent || !agent.isActive) throw new ApiError(401, 'Account not found or disabled');
  assertSessionVersion(decoded, agent);
  await attachPrivilegedSession(decoded, req);
  req.agent = agent;
  await attachActiveCompany(agent, req);
  await touchSession(agent, req);
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
  const agent = await Agent.findById(decoded.id).select('+sessionVersion').populate('role');
  if (!agent || !agent.isActive) throw new ApiError(401, 'Account not found or disabled');
  assertSessionVersion(decoded, agent);
  await attachPrivilegedSession(decoded, req);
  // Company Auditors (role category `auditor`) may enter the admin surface
  // read-only; the admin router blocks their non-GET requests.
  if (!agent.isAdmin && !(agent.role && agent.role.isAdmin) && agent.role?.category !== 'auditor') {
    throw new ApiError(403, 'Admin access required');
  }
  req.agent = agent;
  await attachActiveCompany(agent, req);
  await touchSession(agent, req);
  runWithTenant(req.companyId, next);
});

const protectTenantPrincipal = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Not authorized, please login');
  let decoded;
  try { decoded = verifyToken(token); } catch (_) { throw new ApiError(401, 'Session expired, please login again'); }
  if (decoded.type === 'user') {
    const user = await User.findById(decoded.id).select('+sessionVersion');
    if (!user || user.status !== 'active') throw new ApiError(401, 'Account not found or disabled');
    assertSessionVersion(decoded, user);
    req.user = user;
    await attachActiveCompany(user, req);
    await touchSession(user, req);
    req.user.tenantId = req.companyId;
  } else if (decoded.type === 'agent') {
    const agent = await Agent.findById(decoded.id).select('+sessionVersion').populate('role');
    if (!agent || !agent.isActive) throw new ApiError(401, 'Account not found or disabled');
    assertSessionVersion(decoded, agent);
    req.agent = agent;
    req.user = agent;
    await attachActiveCompany(agent, req);
    await touchSession(agent, req);
    req.user.tenantId = req.companyId;
  } else if (decoded.type === 'superadmin') {
    const superAdmin = await SuperAdmin.findById(decoded.id).select('+sessionVersion');
    if (!superAdmin || !superAdmin.isActive) throw new ApiError(401, 'Account not found or disabled');
    assertSessionVersion(decoded, superAdmin);
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
  const superAdmin = await SuperAdmin.findById(decoded.id).select('+sessionVersion');
  if (!superAdmin || !superAdmin.isActive) {
    throw new ApiError(401, 'Account not found or disabled');
  }
  assertSessionVersion(decoded, superAdmin);
  if (superAdmin.allowedIps && superAdmin.allowedIps.length) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!superAdmin.allowedIps.includes(ip)) {
      throw new ApiError(403, 'Access denied for this IP address');
    }
  }
  superAdmin.lastLogin = new Date();
  await superAdmin.save();
  req.superAdmin = superAdmin;
  await touchSession(superAdmin, req);
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

// Resolve the canonical permission from request data for endpoints that carry
// multiple business actions (for example approve/reject in one decision API).
const requireResolvedPermission = (resolvePermission, opts = {}) =>
  asyncHandler(async (req, res, next) => {
    const permission = resolvePermission(req);
    if (!permission) throw new ApiError(400, 'A supported action is required');
    return requirePermission(permission, opts)(req, res, next);
  });

/**
 * requirePlatformRole(...roles) — SaaS platform RBAC (§1). platform_owner
 * bypasses everything; platform_auditor is globally read-only; legacy
 * SuperAdmin docs without platformRole default to owner so upgrades never
 * lock anyone out.
 */
const requirePlatformRole = (...roles) =>
  asyncHandler(async (req, res, next) => {
    const sa = req.superAdmin;
    if (!sa) throw new ApiError(401, 'Not authorized');
    const role = sa.platformRole || 'platform_owner';
    if (role === 'platform_owner') return next();
    if (role === 'platform_auditor' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      throw new ApiError(403, 'Auditor role is read-only');
    }
    if (!roles.includes(role)) throw new ApiError(403, 'You do not have permission for this action');
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

const requirePlatformPermission = (...perms) =>
  asyncHandler(async (req, res, next) => {
    const superAdmin = req.superAdmin;
    if (!superAdmin) throw new ApiError(401, 'Not authorized');
    if (!superAdmin.platformRole) throw new ApiError(403, 'Platform role migration required for this account');
    if (superAdmin.platformRole === 'platform_owner') return next();
    const { ROLE_PERMISSIONS } = require('../config/platformPermissions');
    const effective = new Set(
      superAdmin.permissions?.length
        ? superAdmin.permissions
        : (ROLE_PERMISSIONS[superAdmin.platformRole] || [])
    );
    if (!perms.some((permission) => effective.has(permission))) {
      throw new ApiError(403, 'You do not have permission for this action');
    }
    next();
  });

const protectTenantAgent = [protectAgent, (req, res, next) => {
  req.user = req.agent;
  req.user.tenantId = req.companyId;
  next();
}];

module.exports = { signToken, verifyToken, protectUser, protectAgent, protectAdmin, protectSuperAdmin, protectTenantAgent, protectTenantPrincipal, optionalUser, requirePermission, requireResolvedPermission, requireSuperAdminPermission, requirePlatformRole, requirePlatformPermission, attachActiveCompany };
