/**
 * IP allowlist enforcement. Lists are tenant-configured
 * (FieldMasking model='__ip_allowlist__', field=JSON array of IPs/CIDRs).
 * Empty/missing list = no restriction. Called from auth guards after the
 * tenant is resolved so spoofed cross-tenant access is impossible.
 */
const ApiError = require('../utils/ApiError');

function ipToInt(ip) {
  const parts = String(ip || '').trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n >>> 0;
}

function cidrMatches(cidr, ip) {
  const [range, bitsRaw] = String(cidr || '').split('/');
  const ipInt = ipToInt(ip);
  if (ipInt === null) return false;
  if (bitsRaw === undefined) return ipToInt(range) === ipInt;
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const rangeInt = ipToInt(range);
  if (rangeInt === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

const normIp = (req) => {
  const raw = req.ip || req.connection?.remoteAddress || '';
  return String(raw).replace(/^::ffff:/, '').trim();
};

async function getAllowlist(companyId) {
  try {
    const mongoose = require('mongoose');
    const coll = mongoose.connection.db.collection('fieldmaskings');
    const docs = await coll.find({ model: '__ip_allowlist__' }).limit(20).toArray();
    const match = companyId ? docs.find((d) => String(d.tenantId || '') === String(companyId)) : null;
    const doc = match || docs.find((d) => !d.tenantId);
    if (!doc?.field) return [];
    const list = JSON.parse(doc.field);
    return Array.isArray(list) ? list.map((c) => String(c).trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

async function enforceIpAllowlist(req) {
  const list = await getAllowlist(req.companyId || null);
  if (!list.length) return;
  const ip = normIp(req);
  if (!list.some((cidr) => cidrMatches(cidr, ip))) {
    try {
      require('../services/audit.service').audit({
        company: req.companyId || null,
        actorType: 'system',
        action: 'security.ip_denied',
        entityType: 'request',
        after: { ip, path: req.path },
        source: 'ip-allowlist',
        req,
      }).catch(() => {});
    } catch (_) { /* never block on audit */ }
    throw new ApiError(403, 'Access denied for this IP address');
  }
}

module.exports = { enforceIpAllowlist, getAllowlist, cidrMatches, ipToInt };
