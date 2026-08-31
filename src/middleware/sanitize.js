// XSS input sanitization middleware — strips script tags, event handlers, and dangerous protocols
const MAX_STRING_LENGTH = 10000;
const MAX_DEPTH = 10;

function sanitizeValue(val) {
  if (typeof val === 'string') return sanitizeString(val);
  if (Array.isArray(val)) {
    if (val.length > 500) val = val.slice(0, 500); // prevent array bomb
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === 'object') return sanitizeObject(val);
  return val;
}

function sanitizeString(str) {
  if (str.length > MAX_STRING_LENGTH) str = str.slice(0, MAX_STRING_LENGTH);
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');
}

function sanitizeObject(obj, depth = 0) {
  if (depth > MAX_DEPTH) return {};
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = sanitizeValue(value);
  }
  return clean;
}

function sanitizeMiddleware(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeObject(req.body);
  if (req.query && typeof req.query === 'object') {
    // Don't mutate query directly (read-only in Express 5); create clean copy
    const clean = sanitizeObject(req.query);
    Object.defineProperty(req, 'query', { value: clean, writable: true });
  }
  if (req.params && typeof req.params === 'object') req.params = sanitizeObject(req.params);
  next();
}

module.exports = { sanitizeMiddleware, sanitizeString, sanitizeObject };
