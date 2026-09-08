/**
 * Central password-policy enforcement. Reads the tenant-configured policy
 * (RetentionPolicy __password_policy__, managed at /gaps/password-policy)
 * with a safe default. Throws ApiError(422) listing violations.
 */
const ApiError = require('./ApiError');

const DEFAULT_POLICY = { minLength: 8, requireUpper: false, requireNumber: false, requireSymbol: false };

async function getPasswordPolicy(companyId) {
  try {
    const mongoose = require('mongoose');
    const coll = mongoose.connection.db.collection('retentionpolicies');
    const docs = await coll.find({ name: '__password_policy__' }).limit(20).toArray();
    const match = companyId
      ? docs.find((d) => String(d.tenantId || '') === String(companyId))
      : null;
    const fallback = docs.find((d) => !d.tenantId);
    const doc = match || fallback;
    if (doc?.action) return { ...DEFAULT_POLICY, ...JSON.parse(doc.action) };
  } catch (_) {
    // fall through to default
  }
  return { ...DEFAULT_POLICY };
}

async function assertPasswordPolicy(password, companyId) {
  const pol = await getPasswordPolicy(companyId);
  const pw = String(password || '');
  const errors = [];
  if (pw.length < (pol.minLength || 8)) errors.push(`Minimum ${pol.minLength || 8} characters`);
  if (pol.requireUpper && !/[A-Z]/.test(pw)) errors.push('Needs an uppercase letter');
  if (pol.requireNumber && !/[0-9]/.test(pw)) errors.push('Needs a number');
  if (pol.requireSymbol && !/[^A-Za-z0-9]/.test(pw)) errors.push('Needs a symbol');
  if (errors.length) throw new ApiError(422, `Password policy: ${errors.join(', ')}`);
  return pol;
}

module.exports = { getPasswordPolicy, assertPasswordPolicy, DEFAULT_POLICY };
