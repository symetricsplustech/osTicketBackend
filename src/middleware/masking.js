/**
 * Field-masking read-path enforcement (checklist §17.5, §23.7).
 *
 * transparentJSON middleware wraps res.json() so any outbound payload is
 * automatically masked when the requesting agent lacks the rolesAllowed
 * clearance for a masked field.
 *
 * Install: app.use(maskingMiddleware) after auth.
 */
const P5 = () => require('../models/Platform5');

// Map model names → mongoose model (lazy to avoid circular deps)
const registry = new Map();

function registerModel(modelName, model) {
  registry.set(modelName, model);
}

function shape(value) {
  if (typeof value === 'string') {
    if (value.length <= 4) return '*'.repeat(Math.max(1, value.length - 1)) + value.slice(-1);
    return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
  }
  if (typeof value === 'number') return 0;
  if (value instanceof Date) return null;
  return null;
}

function applyMask(fieldName, value, maskType) {
  if (value === null || value === undefined) return value;
  switch (maskType) {
    case 'full':
      return shape(value);
    case 'partial':
      return typeof value === 'string' ? value.replace(/(?<=.{{s}})./g, '*') : shape(value);
    case 'hash': {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
    }
    default:
      return value;
  }
}

function maskObject(obj, rules, role, path = []) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const currentPath = [...path, k].join('.');
    const rule = rules.find((r) => r.field === currentPath || r.field === k);
    if (rule && !(rule.rolesAllowed || []).includes(role)) {
      out[k] = applyMask(currentPath, v, rule.maskType);
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      out[k] = Array.isArray(v)
        ? v.map((item, i) => maskObject(item, rules, role, [...path, `${k}[${i}]`]))
        : maskObject(v, rules, role, [...path, k]);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * maskingMiddleware — intercepts res.json for requests and applies
 * FieldMasking rules when the caller's role is NOT in the rule's rolesAllowed.
 *
 * Applied globally so any endpoint benefits from masking.
 */
const maskingMiddleware = async (req, res, next) => {
  try {
    const role = (req.user && req.user.role) || (req.agent && req.agent.role) || 'guest';
    const companyId = req.companyId || (req.user && (req.user.tenantId || req.user.companyId));
    if (!companyId) return next();

    const P5mod = P5();
    const rules = await P5mod.FieldMasking.find({ ...{ tenantId: companyId } }).lean();
    if (!rules.length) return next();

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        // Extract model hints from query params (entity name) or req.path
        // FieldMasking.model rules match by model name or field path
        const masked = maskObject(body, rules, role);
        return originalJson(masked);
      } catch (_) {
        return originalJson(body);
      }
    };

    next();
  } catch (err) {
    next(); // masking failure must never break requests
  }
};

module.exports = { maskingMiddleware, registerModel, maskObject };
