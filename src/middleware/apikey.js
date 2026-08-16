const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const ApiKey = require('../models/ApiKey');

/**
 * API-key auth for the developer platform.
 * Expects: Authorization: Bearer ost_<64 hex chars>
 * Resolves the company scope + sets req.apiKey, req.companyId.
 */
const protectApiKey = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new ApiError(401, 'API key required (Bearer ost_...)');
  const raw = header.slice(7).trim();
  if (!raw.startsWith('ost_')) throw new ApiError(401, 'Invalid API key format');
  const hash = ApiKey.hashKey(raw);
  const key = await ApiKey.findOne({ keyHash: hash, isActive: true });
  if (!key) throw new ApiError(401, 'Invalid or disabled API key');
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) throw new ApiError(401, 'API key expired');
  await ApiKey.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } });
  req.apiKey = key;
  req.companyId = key.company || null;
  req.apiScopes = key.scopes || [];
  next();
});

const hasScope = (req, scope) => (req.apiScopes || []).includes(scope) || (req.apiScopes || []).includes('*');

module.exports = { protectApiKey, hasScope };