function overlaps(startA, endA, startB, endB) {
  const a = new Date(startA).getTime();
  const b = new Date(endA).getTime();
  const c = new Date(startB).getTime();
  const d = new Date(endB).getTime();
  return a < d && c < b;
}

function scoreChangeRisk(change, context) {
  const typeScore = { emergency: 30, standard: 0, normal: 10 };
  const riskScore = { critical: 25, high: 20, medium: 10, low: 0 };
  let score = 0;
  score += typeScore[change.type] || 0;
  score += riskScore[change.risk] || 0;
  score += Math.min((context.overlapping || []).length * 15, 25);
  score += (context.sharedAssets || []).length * 5;
  if (!change.rollbackPlan) score += 15;
  return score;
}

module.exports = { overlaps, scoreChangeRisk };
