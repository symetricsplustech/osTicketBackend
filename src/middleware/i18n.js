/**
 * i18n middleware — detects locale from user prefs / tenant default / Accept-Language header,
 * loads message bundles, and exposes req.t(key, vars) + req.locale on every request.
 *
 * Stack: req.locale detection order →
 *   1. User preference (UserLocalePreference)
 *   2. Tenant default (TenantLocalePreference)
 *   3. Accept-Language header
 *   4. Fallback 'en'
 */
const { MessageBundle, TenantLocalePreference, UserLocalePreference } = require('../models/Locale');

const bundleCache = new Map(); // `${locale}:${namespace}` -> Map(key->value)
const CACHE_TTL_MS = 60 * 1000; // 1 minute
let cacheLoadedAt = 0;

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`));
}

async function loadNamespace(locale, namespace, tenantId) {
  const cacheKey = `${locale}:${namespace}:${tenantId || 'global'}`;
  const hit = bundleCache.get(cacheKey);
  if (hit && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return hit;

  const query = { locale, namespace };
  if (tenantId) query.$or = [{ tenantId }, { tenantId: null }];
  const docs = await MessageBundle.find(query).lean();
  const map = new Map(docs.map((d) => [d.key, d.value]));
  bundleCache.set(cacheKey, map);
  return map;
}

function fallbackChain(locale) {
  const chain = [locale];
  if (locale && locale.includes('-')) chain.push(locale.split('-')[0]); // 'en-GB' -> 'en'
  if (chain[0] !== 'en') chain.push('en');
  return chain;
}

const i18nMiddleware = async (req, _res, next) => {
  try {
    let locale = null;

    // 1. User preference
    if (req.user && req.user._id) {
      const up = await UserLocalePreference.findOne({ user: req.user._id }).lean();
      if (up && up.locale) locale = up.locale;
      if (up && up.timezone) req.timezone = up.timezone;
    }

    // 2. Tenant default
    if (!locale && req.companyId) {
      const tp = await TenantLocalePreference.findOne({ tenantId: req.companyId }).lean();
      if (tp) {
        locale = tp.defaultLocale;
        if (!req.timezone && tp.timezone) req.timezone = tp.timezone;
      }
    }

    // 3. Accept-Language header
    if (!locale && req.headers['accept-language']) {
      locale = String(req.headers['accept-language']).split(',')[0].trim();
    }

    // 4. Fallback
    if (!locale) locale = 'en';

    req.locale = locale;
    if (!req.timezone) req.timezone = 'UTC';

    // Translation helper: req.t('ticket.create.success', { number: 'T-1001' })
    req.t = (key, vars, namespace = 'common') => key; // placeholder replaced below
    req.translate = async (key, vars, namespace = 'common') => {
      for (const loc of fallbackChain(req.locale)) {
        const bundle = await loadNamespace(loc, namespace, req.companyId);
        if (bundle.has(key)) return interpolate(bundle.get(key), vars);
      }
      return key; // return key if not translated
    };

    next();
  } catch (err) {
    // i18n must never block a request
    req.locale = 'en';
    req.timezone = req.timezone || 'UTC';
    req.translate = async (key) => key;
    next();
  }
};

const invalidateCache = () => { bundleCache.clear(); };

module.exports = { i18nMiddleware, invalidateCache };
