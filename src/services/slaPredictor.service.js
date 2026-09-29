// SLA breach predictor — DB-free calculators (MD §ITSM-05 / §82).
// Imports no models so the pure math is unit-testable. Controllers that need
// real records should pass incidence-style rows (with slaDueAt/priority/status)
// through `predictBreachMany`.
const PRIORITY_DEFAULTS = {
  critical: { hours: 4, weight: 1.4 },
  high: { hours: 8, weight: 1.2 },
  medium: { hours: 24, weight: 1.0 },
  low: { hours: 72, weight: 0.8 },
};

function slaTargetFor(priority) {
  return (
    PRIORITY_DEFAULTS[String(priority || "medium").toLowerCase()] ||
    PRIORITY_DEFAULTS.medium
  );
}

function predictBreach(ticket) {
  const t = ticket || {};
  const target = slaTargetFor(t.priority);
  const due = t.slaDueAt || t.dueAt;
  const resolved = ["resolved", "closed", "archived"].includes(t.status);
  if (resolved || !due) {
    return {
      likely: false,
      probability: 0,
      severity: "none",
      reasons: resolved ? ["already_resolved"] : ["no_sla_due"],
    };
  }
  const dueMs = new Date(due).getTime();
  if (!Number.isFinite(dueMs)) {
    return { likely: false, probability: 0, severity: "none", reasons: ["invalid_due"] };
  }
  const now = Date.now();
  const remainingMs = dueMs - now;
  const pastDue = remainingMs <= 0;

  const fractionUsed = Math.max(0, Math.min(1, 1 - remainingMs / (target.hours * 3600 * 1000)));
  let probability =
    (pastDue ? 1 : fractionUsed) * target.weight;

  if (t.progress !== undefined) {
    const progress = Math.max(0, Math.min(1, Number(t.progress) || 0));
    probability *= 1 - progress * 0.5;
  }

  probability = Math.max(0, Math.min(1, probability));
  const severity = pastDue
    ? "breached"
    : probability >= 0.9
      ? "critical"
      : probability >= 0.75
        ? "warning"
        : "ok";
  return {
    likely: probability >= 0.75 || pastDue,
    probability: Number(probability.toFixed(3)),
    severity,
    remainingHours: Number((remainingMs / 3600 / 1000).toFixed(2)),
    targetHours: target.hours,
    reasons: pastDue
      ? ["past_due"]
      : probability >= 0.9
        ? ["at_risk_high"]
        : probability >= 0.75
          ? ["at_risk"]
          : ["within_target"],
  };
}

function predictBreachMany(rows) {
  return (rows || []).map((row) => {
    const result = predictBreach(row);
    return { ref: row && (row.number || row._id || row.id), ...result };
  });
}

module.exports = { predictBreach, predictBreachMany, slaTargetFor };