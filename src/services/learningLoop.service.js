/**
 * Continuous learning loop (MD §82 / Predictive Intelligence analog).
 *
 * Runs in the background on a schedule: discovers every active tenant and
 * refreshes its triage/routing training set, so learned routing and the
 * virtual agent improve as new resolved tickets accumulate — without manual
 * retraining. Evicts the suggestion-engine cache after refresh so the next
 * inference rebuilds from fresh (warmer) data.
 *
 * This is the offline "free AI" continuous-learning mechanism: no external
 * service, no data egress, just per-tenant model refresh + warm-up.
 */

const Company = require('../models/Company');
const { fetchTrainingSet, invalidateTraining } = require('./suggestion.service');
const logger = require('../utils/logger');

let running = false;

/**
 * One sweep over all active tenants. Returns per-tenant results.
 */
async function runLearningSweep() {
  if (running) return { skipped: true, reason: 'sweep already running' };
  running = true;
  const results = { companies: 0, docsRefreshed: 0, errors: 0, startedAt: new Date() };
  try {
    const companies = await Company.find({ status: { $nin: ['disabled', 'suspended'] } })
      .select('_id name')
      .limit(500)
      .lean();
    for (const company of companies) {
      try {
        // Force-refresh: invalidate first, then warm from Mongo.
        invalidateTraining(company._id);
        const docs = await fetchTrainingSet(company._id, 500);
        results.docsRefreshed += Array.isArray(docs) ? docs.length : 0;
        results.companies += 1;
      } catch (_) {
        results.errors += 1;
      }
    }
    return results;
  } finally {
    running = false;
  }
}

/**
 * Start the background loop. Interval default 30 min (config override via
 * env LEARNING_SWEEP_MS). setInterval keeps the process alive like other
 * platform schedulers.
 */
function startLearningLoop(intervalMs = Number(process.env.LEARNING_SWEEP_MS) || 30 * 60 * 1000) {
  // Warm immediately at boot (deferred so DB is ready in tests).
  setTimeout(() => runLearningSweep().catch((e) => logger.error('learning sweep failed:', e.message)), 1000).unref();
  return setInterval(() => {
    runLearningSweep().catch((e) => logger.error('learning sweep failed:', e.message));
  }, intervalMs);
}

module.exports = { startLearningLoop, runLearningSweep };