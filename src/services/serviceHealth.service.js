const E = require('../models/Enterprise');
const Alert = require('../models/Alert');

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

function scoreCI(ci) {
  let s = 100;
  if (ci.status === 'stale' || ci.status === 'maintenance') s -= 20;
  if (!ci.lastCertifiedAt) s -= 15;
  if (ci.criticality === 'critical' && ci.status !== 'operational') s -= 10;
  return clamp(s);
}

async function fetchDownstreamBad(ciIds, depthLimit = 2, maxVisited = 200) {
  const visited = new Set();
  let frontier = ciIds.map(String);
  let depth = 0;
  while (frontier.length && depth < depthLimit) {
    const next = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      if (visited.size > maxVisited) return visited;
      try {
        const ci = await E.CI.findById(id).select('relationships').lean();
        if (ci?.relationships) {
          for (const rel of ci.relationships) {
            if (rel.target) next.push(String(rel.target));
          }
        }
      } catch (_) { /* skip missing refs */ }
    }
    frontier = next;
    depth++;
  }
  return visited;
}

async function fetchFiringAlerts(tenantId, serviceName) {
  try {
    const alerts = await Alert.find({ company: tenantId, service: serviceName, status: 'firing' }).lean();
    if (alerts.length) return alerts;
  } catch (_) { /* field may not match */ }
  try {
    return await Alert.find({ company: tenantId, status: 'firing', 'labels.service': serviceName }).lean();
  } catch (_) { return []; }
}

const ALERT_PENALTY = { emergency: 25, critical: 15, warning: 5, info: 0 };

async function computeServiceHealth(tenantId) {
  const services = await E.BusinessService.find({ tenantId }).lean();
  const results = [];
  let totalHealthy = 0, totalDegraded = 0, totalCritical = 0;
  let totalCIs = 0, totalFiring = 0;

  for (const svc of services) {
    const ciIds = (svc.cis || []).map(String);
    const cis = ciIds.length
      ? await E.CI.find({ _id: { $in: ciIds } }).lean()
      : [];
    totalCIs += cis.length;

    // CI health scoring
    let score = 100;
    for (const ci of cis) {
      if (ci.status === 'stale' || ci.status === 'maintenance') score -= 20;
      if (!ci.lastCertifiedAt) score -= 15;
      if (ci.criticality === 'critical' && ci.status !== 'operational') score -= 10;
    }
    score = clamp(score);

    // Firing alerts
    const alerts = await fetchFiringAlerts(tenantId, svc.name);
    totalFiring += alerts.length;
    for (const a of alerts) {
      score -= ALERT_PENALTY[a.severity] || 0;
    }
    score = clamp(score);

    // Downstream / relationship propagation
    const downstream = await fetchDownstreamBad(ciIds);
    // remove the original CIs themselves
    for (const cid of ciIds) downstream.delete(cid);
    // check each downstream CI for stale/maintenance
    for (const dsId of downstream) {
      try {
        const dsCI = await E.CI.findById(dsId).select('status').lean();
        if (dsCI && (dsCI.status === 'stale' || dsCI.status === 'maintenance')) {
          score -= 5;
        }
      } catch (_) { /* skip */ }
    }
    score = clamp(score);

    const status = score < 40 ? 'critical' : score < 75 ? 'degraded' : 'healthy';
    if (status === 'healthy') totalHealthy++;
    else if (status === 'degraded') totalDegraded++;
    else totalCritical++;

    // Persist
    try {
      await E.BusinessService.collection.updateOne(
        { _id: svc._id },
        { $set: { healthScore: score } }
      );
    } catch (_) { /* best-effort */ }

    results.push({
      _id: svc._id,
      name: svc.name,
      serviceType: svc.serviceType,
      criticality: svc.criticality,
      healthScore: score,
      ciCount: cis.length,
      firingAlertCount: alerts.length,
      status,
    });
  }

  return {
    services: results,
    overview: {
      healthy: totalHealthy,
      degraded: totalDegraded,
      critical: totalCritical,
      monitoredCis: totalCIs,
      firingAlerts: totalFiring,
    },
  };
}

async function recomputeAllHealth() {
  const tenants = await E.BusinessService.distinct('tenantId');
  let totalServices = 0, totalHealthy = 0, totalDegraded = 0, totalCritical = 0;
  let totalCIs = 0, totalFiring = 0;

  for (const tenantId of tenants) {
    const result = await computeServiceHealth(tenantId);
    totalServices += result.services.length;
    totalHealthy += result.overview.healthy;
    totalDegraded += result.overview.degraded;
    totalCritical += result.overview.critical;
    totalCIs += result.overview.monitoredCis;
    totalFiring += result.overview.firingAlerts;
  }

  return {
    tenantsProcessed: tenants.length,
    overview: {
      totalServices,
      healthy: totalHealthy,
      degraded: totalDegraded,
      critical: totalCritical,
      monitoredCis: totalCIs,
      firingAlerts: totalFiring,
    },
  };
}

module.exports = { computeServiceHealth, recomputeAllHealth };
