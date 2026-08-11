const jwt = require('jsonwebtoken');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Agent = require('../models/Agent');
const SuperAdmin = require('../models/SuperAdmin');
const asyncHandler = require('../utils/asyncHandler');

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
  req.companyId = user.company || null;
  next();
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
          req.companyId = user.company || null;
        }
      }
    } catch (err) {
      // ignore invalid optional token
    }
  }
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
  req.companyId = agent.company || null;
  next();
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
  req.companyId = agent.company || null;
  next();
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

const requirePermission = (perm) =>
  asyncHandler(async (req, res, next) => {
    const agent = req.agent;
    if (!agent) throw new ApiError(401, 'Not authorized');
    if (agent.isAdmin || (agent.role && agent.role.isAdmin)) return next();
    const perms = new Set([...(agent.permissions || []), ...(agent.role?.permissions || [])]);
    if (!perms.has(perm)) throw new ApiError(403, 'You do not have permission for this action');
    next();
  });

module.exports = { signToken, verifyToken, protectUser, protectAgent, protectAdmin, protectSuperAdmin, optionalUser, requirePermission };
