/**
 * Dependency-free TOTP (RFC 6238, SHA-1) for two-factor enforcement.
 * Secrets are base32 (as produced by authenticator-app provisioning).
 */
const crypto = require('crypto');

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    bits += BASE32.indexOf(ch).toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(key, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  // 64-bit big-endian counter (high 32 bits are zero for our lifetimes)
  msg.writeUInt32BE(0, 0);
  msg.writeUInt32BE(counter, 4);
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

function generateSecret(bytes = 20) {
  const raw = crypto.randomBytes(bytes);
  let out = '';
  let bits = '';
  for (const b of raw) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function otpauthUrl({ issuer = 'osTicket', account, secret }) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

/**
 * Verify a TOTP code within ±window steps (default 1 = ~90s tolerance).
 */
function verifyTotp(secret, code, { window = 1, step = 30 } = {}) {
  const digits = String(code || '').replace(/[\s-]/g, '');
  if (!/^\d{6,8}$/.test(digits) || !secret) return false;
  let key;
  try {
    key = base32Decode(secret);
  } catch (_) {
    return false;
  }
  if (!key.length) return false;
  const t = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i += 1) {
    let expected;
    try {
      expected = hotp(key, t + i, digits.length);
    } catch (_) {
      return false;
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(digits);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

module.exports = { base32Decode, hotp, generateSecret, otpauthUrl, verifyTotp };
