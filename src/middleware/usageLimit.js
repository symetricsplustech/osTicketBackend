/**
 * Usage-limit enforcement middleware (checklist §1.13).
 *
 * Reads tenant plan limits, checks current-month UsageMeter, and hard-blocks
 * requests with HTTP 429 when a hardBlock limit is exceeded.
 * Attached via app.js → usageGuard('apiCalls') style.
 */
const { UsageMeter, UsageLimit } = require('../models/UsageLimit');
const ApiError = require('../utils/ApiError');

function currentPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Increment a metric counter (fire-and-forget). */
function meter(tenantId, metric, amount = 1) {
  if (!tenantId) return;
  UsageMeter.findOneAndUpdate(
    { tenantId, period: currentPeriod() },
    { $inc: { [metric]: amount } },
    { upsert: true }
  ).catch(() => {});
}

/**
 * usageGuard(metric) → middleware that hard-blocks when this metric exceeds its
 * configured limit for the tenant. Hard-block only fires when the matching
 * UsageLimit has hardBlock=true; otherwise the request passes and the excess
 * is merely counted.
 */
const usageGuard = (metric) => async (req, res, next) => {
  try {
    const tenantId = req.companyId || (req.user && (req.user.tenantId || req.user.companyId)) || null;
    if (!tenantId) return next();
    const period = currentPeriod();

    const limitDoc = await UsageLimit.findOne({ tenantId, metric }).lean();
    if (!limitDoc) {
      meter(tenantId, metric);
      return next();
    }

    const meterDoc = await UsageMeter.findOne({ tenantId, period }).lean();
    const used = (meterDoc && meterDoc[metric]) || 0;

    if (limitDoc.hardBlock && used >= limitDoc.limit) {
      // audit the block
      try {
        require('../services/audit.service').audit({
          company: tenantId,
          actorType: 'system',
          actor: null,
          action: 'usage.hard_block',
          entityType: 'usage_limit',
          entityId: limitDoc._id,
          after: { metric, used, limit: limitDoc.limit, path: req.originalUrl },
          source: 'usage-middleware',
          req,
        }).catch(() => {});
      } catch (_) { /* audit must not block */ }
      throw new ApiError(429, `Usage limit reached for ${metric} (${used}/${limitDoc.limit}). Upgrade plan or contact admin.`);
    }

    // warn-at threshold → attach response header
    if (limitDoc.warnAtPct && used / limitDoc.limit >= limitDoc.warnAtPct / 100) {
      res.setHeader('X-Usage-Warning', `${metric} ${used}/${limitDoc.limit} (limit reached ${limitDoc.warnAtPct}% threshold)`);
    }

    meter(tenantId, metric);
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(); // enforcement must never break the app
  }
};

/** Start the monthly meter (idempotent; safe on every request or cron). */
async function ensurePeriod(tenantId) {
  if (!tenantId) return;
  await UsageMeter.findOneAndUpdate(
    { tenantId, period: currentPeriod() },
    { $setOnInsert: { tenantId, period: currentPeriod() } },
    { upsert: true }
  );
}

module.exports = { usageGuard, meter, ensurePeriod, currentPeriod };
