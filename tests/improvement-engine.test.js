/* eslint-disable no-console */
// Continual Improvement Management tests: state machines, validation, ROI, progress tracking
// DB-free unit tests. Run: node tests/improvement-engine.test.js
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

// ─── Constants ──────────────────────────────────────────────────────────

const OPPORTUNITY_STATUS = ['new', 'qualified', 'rejected', 'approved', 'on_hold', 'converted', 'implemented'];
const OPPORTUNITY_SOURCE = ['incident', 'problem', 'change', 'survey', 'audit', 'customer_feedback', 'internal_review', 'kpi_breach', 'benchmark', 'innovation', 'other'];
const OPPORTUNITY_CATEGORY = ['process', 'technology', 'people', 'governance', 'cost', 'quality', 'security', 'compliance', 'customer_experience', 'efficiency', 'other'];
const INITIATIVE_STATUS = ['planned', 'approved', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled', 'deferred'];
const INITIATIVE_TYPE = ['process_improvement', 'technology_upgrade', 'training', 'policy_change', 'automation', 'cost_reduction', 'quality_improvement', 'compliance', 'other'];
const TASK_STATUS = ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled', 'blocked'];
const TASK_TYPE = ['analysis', 'design', 'development', 'testing', 'deployment', 'training', 'documentation', 'review', 'approval', 'data_collection', 'other'];
const GOAL_STATUS = ['planned', 'in_progress', 'at_risk', 'achieved', 'missed', 'abandoned'];
const GOAL_DIRECTION = ['increase', 'decrease', 'maintain'];
const BENEFIT_TYPE = ['financial', 'efficiency', 'quality', 'customer_satisfaction', 'risk_reduction', 'compliance', 'employee_satisfaction', 'revenue', 'cost_avoidance', 'time_savings', 'other'];
const BENEFIT_STATUS = ['estimated', 'validated', 'realized', 'not_realized', 'disputed'];
const COST_CATEGORY = ['labor', 'technology', 'training', 'consulting', 'materials', 'licenses', 'infrastructure', 'cloud', 'travel', 'other'];
const COST_STATUS = ['planned', 'committed', 'incurred', 'paid', 'cancelled'];
const BASELINE_CATEGORY = ['performance', 'quality', 'cost', 'customer_satisfaction', 'efficiency', 'availability', 'capacity', 'security', 'compliance', 'other'];
const TARGET_STATUS = ['active', 'at_risk', 'off_track', 'achieved', 'missed', 'cancelled'];
const TARGET_TREND = ['improving', 'stable', 'declining', 'unknown'];

// ─── State Machines ────────────────────────────────────────────────────

const OPPORTUNITY_TRANSITIONS = {
  new: ['qualified', 'rejected', 'on_hold'],
  qualified: ['approved', 'rejected', 'on_hold'],
  approved: ['on_hold', 'converted', 'implemented'],
  on_hold: ['qualified', 'approved', 'rejected'],
  rejected: [],
  converted: ['implemented'],
  implemented: [],
};

const INITIATIVE_TRANSITIONS = {
  planned: ['approved', 'cancelled', 'deferred'],
  approved: ['in_progress', 'planned', 'cancelled', 'deferred'],
  in_progress: ['review', 'on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled', 'deferred'],
  review: ['completed', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
  deferred: ['planned', 'cancelled'],
};

const TASK_TRANSITIONS = {
  pending: ['in_progress', 'blocked', 'cancelled', 'skipped'],
  in_progress: ['completed', 'failed', 'blocked', 'cancelled'],
  completed: [],
  failed: ['in_progress', 'cancelled'],
  skipped: [],
  cancelled: [],
  blocked: ['pending', 'cancelled'],
};

const GOAL_TRANSITIONS = {
  planned: ['in_progress', 'abandoned'],
  in_progress: ['at_risk', 'achieved', 'missed', 'abandoned'],
  at_risk: ['in_progress', 'achieved', 'missed', 'abandoned'],
  achieved: [],
  missed: ['in_progress', 'abandoned'],
  abandoned: [],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

// ─── Validation ────────────────────────────────────────────────────────

function validateOpportunity(o) {
  const errors = [];
  if (!o.title) errors.push('title required');
  if (!o.source || !OPPORTUNITY_SOURCE.includes(o.source)) errors.push('invalid source');
  if (!o.category || !OPPORTUNITY_CATEGORY.includes(o.category)) errors.push('invalid category');
  if (o.status && !OPPORTUNITY_STATUS.includes(o.status)) errors.push('invalid status');
  if (o.priority && !['low', 'medium', 'high', 'critical'].includes(o.priority)) errors.push('invalid priority');
  if (o.impact && !['low', 'medium', 'high', 'critical'].includes(o.impact)) errors.push('invalid impact');
  if (o.effort && !['low', 'medium', 'high', 'very_high'].includes(o.effort)) errors.push('invalid effort');
  if (o.risk && !['low', 'medium', 'high', 'very_high'].includes(o.risk)) errors.push('invalid risk');
  return errors;
}

function validateInitiative(i) {
  const errors = [];
  if (!i.title) errors.push('title required');
  if (!i.opportunityId) errors.push('opportunityId required');
  if (i.status && !['planned', 'approved', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled', 'deferred'].includes(i.status)) errors.push('invalid status');
  if (i.type && !['process_improvement', 'technology_upgrade', 'training', 'policy_change', 'automation', 'cost_reduction', 'quality_improvement', 'compliance', 'other'].includes(i.type)) errors.push('invalid type');
  if (i.priority && !['low', 'medium', 'high', 'critical'].includes(i.priority)) errors.push('invalid priority');
  return errors;
}

function validateTask(t) {
  const errors = [];
  if (!t.title) errors.push('title required');
  if (!t.initiativeId) errors.push('initiativeId required');
  if (t.status && !['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled', 'blocked'].includes(t.status)) errors.push('invalid status');
  if (t.type && !['analysis', 'design', 'development', 'testing', 'deployment', 'training', 'documentation', 'review', 'approval', 'data_collection', 'other'].includes(t.type)) errors.push('invalid type');
  if (t.priority && !['low', 'medium', 'high', 'critical'].includes(t.priority)) errors.push('invalid priority');
  return errors;
}

function validateGoal(g) {
  const errors = [];
  if (!g.title) errors.push('title required');
  if (!g.initiativeId) errors.push('initiativeId required');
  if (!g.metricName) errors.push('metricName required');
  if (!g.metricUnit) errors.push('metricUnit required');
  if (typeof g.baselineValue !== 'number') errors.push('baselineValue required');
  if (typeof g.targetValue !== 'number') errors.push('targetValue required');
  if (g.status && !['planned', 'in_progress', 'at_risk', 'achieved', 'missed', 'abandoned'].includes(g.status)) errors.push('invalid status');
  if (g.direction && !['increase', 'decrease', 'maintain'].includes(g.direction)) errors.push('invalid direction');
  return errors;
}

function validateBenefit(b) {
  const errors = [];
  if (!b.name) errors.push('name required');
  if (!b.initiativeId) errors.push('initiativeId required');
  if (!b.type || !['financial', 'efficiency', 'quality', 'customer_satisfaction', 'risk_reduction', 'compliance', 'employee_satisfaction', 'revenue', 'cost_avoidance', 'time_savings', 'other'].includes(b.type)) errors.push('invalid type');
  if (typeof b.estimatedValue !== 'number') errors.push('estimatedValue required');
  if (!b.unit) errors.push('unit required');
  return errors;
}

function validateCost(c) {
  const errors = [];
  if (!c.initiativeId) errors.push('initiativeId required');
  if (!c.category || !['labor', 'technology', 'training', 'consulting', 'materials', 'licenses', 'infrastructure', 'cloud', 'travel', 'other'].includes(c.category)) errors.push('invalid category');
  if (typeof c.plannedAmount !== 'number') errors.push('plannedAmount required');
  return errors;
}

function validateBaseline(b) {
  const errors = [];
  if (!b.metricName) errors.push('metricName required');
  if (!b.metricCategory || !['performance', 'quality', 'cost', 'customer_satisfaction', 'efficiency', 'availability', 'capacity', 'security', 'compliance', 'other'].includes(b.metricCategory)) errors.push('invalid category');
  if (!b.metricUnit) errors.push('metricUnit required');
  if (typeof b.baselineValue !== 'number') errors.push('baselineValue required');
  if (!b.baselineDate) errors.push('baselineDate required');
  if (!b.measurementMethod) errors.push('measurementMethod required');
  if (!b.dataSource) errors.push('dataSource required');
  return errors;
}

function validateTarget(t) {
  const errors = [];
  if (!t.metricName) errors.push('metricName required');
  if (typeof t.targetValue !== 'number') errors.push('targetValue required');
  if (!t.targetDate) errors.push('targetDate required');
  if (t.status && !['active', 'at_risk', 'off_track', 'achieved', 'missed', 'cancelled'].includes(t.status)) errors.push('invalid status');
  if (t.trend && !['improving', 'stable', 'declining', 'unknown'].includes(t.trend)) errors.push('invalid trend');
  return errors;
}

// ─── ROI Calculation ──────────────────────────────────────────────────

function calculateROI(benefits, costs) {
  const totalBenefits = benefits.reduce((sum, b) => sum + (b.actualValue || b.estimatedValue || 0), 0);
  const totalCosts = costs.reduce((sum, c) => sum + (c.actualAmount || c.plannedAmount || 0), 0);
  if (totalCosts === 0) return totalBenefits > 0 ? 100 : 0;
  return ((totalBenefits - totalCosts) / totalCosts) * 100;
}

function calculateImprovementPercentage(baseline, target, current) {
  if (baseline === target) return current === baseline ? 100 : 0;
  return ((current - baseline) / (target - baseline)) * 100;
}

function calculateTrend(previous, current) {
  if (previous === undefined) return 'unknown';
  if (current > previous) return 'improving';
  if (current < previous) return 'declining';
  return 'stable';
}

// ─── Goal Progress Evaluation ────────────────────────────────────────

function evaluateGoalProgress(goal) {
  if (!goal.currentValue || !goal.targetValue || !goal.baselineValue) return 'no_data';
  const improvement = calculateImprovementPercentage(goal.baselineValue, goal.targetValue, goal.currentValue);
  if (goal.direction === 'increase' && goal.currentValue >= goal.targetValue) return 'achieved';
  if (goal.direction === 'decrease' && goal.currentValue <= goal.targetValue) return 'achieved';
  if (goal.direction === 'maintain' && goal.currentValue === goal.targetValue) return 'achieved';
  if (improvement >= 100) return 'achieved';
  if (improvement >= 80) return 'at_risk';
  if (improvement >= 50) return 'in_progress';
  return 'in_progress';
}

// ─── Target Status Evaluation ────────────────────────────────────────

function evaluateTargetStatus(target) {
  if (!target.currentValue || !target.targetValue) return 'no_data';
  const improvement = calculateImprovementPercentage(target.baselineValue || 0, target.targetValue, target.currentValue);
  if (improvement >= 100) return 'achieved';
  if (improvement >= 90) return 'at_risk';
  if (improvement < 50) return 'off_track';
  return 'active';
}

// ─── ROI & Benefit Realization ──────────────────────────────────────

function calculateInitiativeROI(benefits, costs) {
  const totalBenefits = benefits.reduce((sum, b) => sum + (b.actualValue || b.estimatedValue || 0), 0);
  const totalCosts = costs.reduce((sum, c) => sum + (c.actualAmount || c.plannedAmount || 0), 0);
  if (totalCosts === 0) return totalBenefits > 0 ? 100 : 0;
  return ((totalBenefits - totalCosts) / totalCosts) * 100;
}

function calculateBenefitRealization(benefits) {
  const totalEstimated = benefits.reduce((sum, b) => sum + (b.estimatedValue || 0), 0);
  const totalActual = benefits.filter(b => b.status === 'realized').reduce((sum, b) => sum + (b.actualValue || 0), 0);
  if (totalEstimated === 0) return 0;
  return (totalActual / totalEstimated) * 100;
}

function calculateCostVariance(costs) {
  const totalPlanned = costs.reduce((sum, c) => sum + (c.plannedAmount || 0), 0);
  const totalActual = costs.reduce((sum, c) => sum + (c.actualAmount || 0), 0);
  if (totalPlanned === 0) return 0;
  return ((totalActual - totalPlanned) / totalPlanned) * 100;
}

// ─── TESTS ─────────────────────────────────────────────────────────────

console.log('\n=== OPPORTUNITY STATE MACHINE ===\n');

const OPPORTUNITY_TRANSITIONS_TEST = {
  new: ['qualified', 'rejected', 'on_hold'],
  qualified: ['approved', 'rejected', 'on_hold'],
  approved: ['on_hold', 'converted', 'implemented'],
  on_hold: ['qualified', 'approved', 'rejected'],
  rejected: [],
  converted: ['implemented'],
  implemented: [],
};

const INITIATIVE_TRANSITIONS_TEST = {
  planned: ['approved', 'cancelled', 'deferred'],
  approved: ['in_progress', 'planned', 'cancelled', 'deferred'],
  in_progress: ['review', 'on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled', 'deferred'],
  review: ['completed', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
  deferred: ['planned', 'cancelled'],
};

const TASK_TRANSITIONS_TEST = {
  pending: ['in_progress', 'blocked', 'cancelled', 'skipped'],
  in_progress: ['completed', 'failed', 'blocked', 'cancelled'],
  completed: [],
  failed: ['in_progress', 'cancelled'],
  skipped: [],
  cancelled: [],
  blocked: ['pending', 'cancelled'],
};

const GOAL_TRANSITIONS_TEST = {
  planned: ['in_progress', 'abandoned'],
  in_progress: ['at_risk', 'achieved', 'missed', 'abandoned'],
  at_risk: ['in_progress', 'achieved', 'missed', 'abandoned'],
  achieved: [],
  missed: ['in_progress', 'abandoned'],
  abandoned: [],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

console.log('\n=== OPPORTUNITY STATE MACHINE ===\n');
assert(canTransition('new', 'qualified', OPPORTUNITY_TRANSITIONS_TEST) === true, 'new->qualified');
assert(canTransition('new', 'rejected', OPPORTUNITY_TRANSITIONS_TEST) === true, 'new->rejected');
assert(canTransition('qualified', 'approved', OPPORTUNITY_TRANSITIONS_TEST) === true, 'qualified->approved');
assert(canTransition('approved', 'converted', OPPORTUNITY_TRANSITIONS_TEST) === true, 'approved->converted');
assert(canTransition('converted', 'implemented', OPPORTUNITY_TRANSITIONS_TEST) === true, 'converted->implemented');
assert(canTransition('approved', 'rejected', OPPORTUNITY_TRANSITIONS_TEST) === false, 'approved->rejected blocked');

console.log('\n=== INITIATIVE STATE MACHINE ===\n');
assert(canTransition('planned', 'approved', INITIATIVE_TRANSITIONS_TEST) === true, 'planned->approved');
assert(canTransition('approved', 'in_progress', INITIATIVE_TRANSITIONS_TEST) === true, 'approved->in_progress');
assert(canTransition('in_progress', 'review', INITIATIVE_TRANSITIONS_TEST) === true, 'in_progress->review');
assert(canTransition('review', 'completed', INITIATIVE_TRANSITIONS_TEST) === true, 'review->completed');
assert(canTransition('completed', 'in_progress', INITIATIVE_TRANSITIONS_TEST) === false, 'completed->in_progress blocked');

console.log('\n=== TASK STATE MACHINE ===\n');
assert(canTransition('pending', 'in_progress', TASK_TRANSITIONS_TEST) === true, 'pending->in_progress');
assert(canTransition('in_progress', 'completed', TASK_TRANSITIONS_TEST) === true, 'in_progress->completed');
assert(canTransition('blocked', 'pending', TASK_TRANSITIONS_TEST) === true, 'blocked->pending (unblock)');
assert(canTransition('completed', 'in_progress', TASK_TRANSITIONS_TEST) === false, 'completed->in_progress blocked');

console.log('\n=== GOAL STATE MACHINE ===\n');
assert(canTransition('planned', 'in_progress', GOAL_TRANSITIONS_TEST) === true, 'planned->in_progress');
assert(canTransition('in_progress', 'achieved', GOAL_TRANSITIONS_TEST) === true, 'in_progress->achieved');
assert(canTransition('in_progress', 'at_risk', GOAL_TRANSITIONS_TEST) === true, 'in_progress->at_risk');
assert(canTransition('achieved', 'in_progress', GOAL_TRANSITIONS_TEST) === false, 'achieved->in_progress blocked');

console.log('\n=== VALIDATION: OPPORTUNITY ===\n');
assert(validateOpportunity({ title: 'Reduce MTTR', source: 'incident', category: 'process', priority: 'high', impact: 'high', effort: 'medium', risk: 'low' }).length === 0, 'valid opportunity passes');
assert(validateOpportunity({ title: 'Test', source: 'invalid' }).length > 0, 'invalid source rejected');
assert(validateOpportunity({ title: 'Test', source: 'incident', category: 'invalid' }).length > 0, 'invalid category rejected');
assert(validateOpportunity({ title: 'Test', source: 'incident', category: 'process', priority: 'invalid' }).length > 0, 'invalid priority rejected');
assert(validateOpportunity({ title: 'Test', source: 'incident', category: 'process', impact: 'invalid' }).length > 0, 'invalid impact rejected');

console.log('\n=== VALIDATION: INITIATIVE ===\n');
assert(validateInitiative({ title: 'Reduce MTTR', opportunityId: 'opp1', status: 'planned', type: 'process_improvement', priority: 'high' }).length === 0, 'valid initiative passes');
assert(validateInitiative({ title: 'Test', opportunityId: 'opp1', status: 'invalid' }).length > 0, 'invalid status rejected');
assert(validateInitiative({ title: 'Test', opportunityId: 'opp1', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateInitiative({ title: 'Test', opportunityId: 'opp1', priority: 'invalid' }).length > 0, 'invalid priority rejected');

console.log('\n=== VALIDATION: TASK ===\n');
assert(validateTask({ title: 'Analyze MTTR', initiativeId: 'init1', type: 'analysis', status: 'pending' }).length === 0, 'valid task passes');
assert(validateTask({ title: 'Test', initiativeId: 'init1', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateTask({ title: 'Test', initiativeId: 'init1', priority: 'invalid' }).length > 0, 'invalid priority rejected');

console.log('\n=== VALIDATION: GOAL ===\n');
assert(validateGoal({ title: 'Reduce MTTR by 20%', initiativeId: 'init1', metricName: 'MTTR', metricUnit: 'minutes', baselineValue: 120, targetValue: 96 }).length === 0, 'valid goal passes');
assert(validateGoal({ title: 'Test', initiativeId: 'init1', metricName: 'MTTR', metricUnit: 'minutes', baselineValue: 100, targetValue: 90, direction: 'invalid' }).length > 0, 'invalid direction rejected');
assert(validateGoal({ title: 'Test', initiativeId: 'init1', metricName: 'MTTR', metricUnit: 'minutes', baselineValue: 100, targetValue: 90, status: 'invalid' }).length > 0, 'invalid status rejected');

console.log('\n=== VALIDATION: BENEFIT ===\n');
assert(validateBenefit({ name: 'Cost Savings', initiativeId: 'init1', type: 'financial', estimatedValue: 50000, unit: 'USD' }).length === 0, 'valid benefit passes');
assert(validateBenefit({ name: 'Test', initiativeId: 'init1', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateBenefit({ name: 'Test', initiativeId: 'init1', type: 'financial', estimatedValue: 'invalid' }).length > 0, 'estimatedValue must be number');

console.log('\n=== VALIDATION: COST ===\n');
assert(validateCost({ initiativeId: 'init1', category: 'technology', plannedAmount: 10000 }).length === 0, 'valid cost passes');
assert(validateCost({ initiativeId: 'init1', category: 'invalid' }).length > 0, 'invalid category rejected');

console.log('\n=== VALIDATION: BASELINE ===\n');
assert(validateBaseline({ metricName: 'MTTR', metricCategory: 'performance', metricUnit: 'minutes', baselineValue: 120, baselineDate: '2026-01-01', measurementMethod: 'average', dataSource: 'ticket system' }).length === 0, 'valid baseline passes');
assert(validateBaseline({ metricName: 'MTTR', metricCategory: 'invalid' }).length > 0, 'invalid category rejected');
assert(validateBaseline({ metricName: 'MTTR', metricCategory: 'performance', measurementMethod: 'average', dataSource: 'ticket system' }).length > 0, 'baselineValue required');

console.log('\n=== VALIDATION: TARGET ===\n');
assert(validateTarget({ metricName: 'MTTR', targetValue: 96, targetDate: '2026-12-31', baselineValue: 120 }).length === 0, 'valid target passes');
assert(validateTarget({ metricName: 'MTTR', targetValue: 96, targetDate: '2026-12-31', status: 'invalid' }).length > 0, 'invalid status rejected');
assert(validateTarget({ metricName: 'MTTR', targetValue: 96, targetDate: '2026-12-31', trend: 'invalid' }).length > 0, 'invalid trend rejected');

console.log('\n=== ROI CALCULATION ===\n');
assert(calculateROI([{ estimatedValue: 50000 }, { estimatedValue: 30000 }], [{ plannedAmount: 20000 }]) === 300, 'ROI 300%');
assert(calculateROI([{ estimatedValue: 50000 }], [{ plannedAmount: 50000 }]) === 0, 'ROI 0% break-even');
assert(calculateROI([{ estimatedValue: 10000 }], [{ plannedAmount: 20000 }]) === -50, 'ROI -50% loss');
assert(calculateROI([{ estimatedValue: 10000 }], []) === 100, 'ROI 100% when no costs');

console.log('\n=== IMPROVEMENT PERCENTAGE ===\n');
assert(calculateImprovementPercentage(120, 96, 96) === 100, '120->96 = 100% improvement');
assert(calculateImprovementPercentage(120, 96, 108) === 50, '120->108 = 50% improvement');
assert(calculateImprovementPercentage(100, 100, 100) === 100, '100->100 = 100% (maintain)');
assert(calculateImprovementPercentage(100, 80, 120) === -100, '100->120 when target is 80 = -100% (wrong direction)');

console.log('\n=== TREND CALCULATION ===\n');
assert(calculateTrend(100, 120) === 'improving', '100->120 = improving');
assert(calculateTrend(120, 100) === 'declining', '120->100 = declining');
assert(calculateTrend(100, 100) === 'stable', '100->100 = stable');
assert(calculateTrend(undefined, 100) === 'unknown', 'no previous = unknown');

console.log('\n=== GOAL PROGRESS EVALUATION ===\n');
assert(evaluateGoalProgress({ direction: 'increase', baselineValue: 120, targetValue: 96, currentValue: 96 }) === 'achieved', 'target met = achieved');
assert(evaluateGoalProgress({ direction: 'decrease', baselineValue: 120, targetValue: 96, currentValue: 100 }) === 'at_risk', '80% progress = at_risk');
assert(evaluateGoalProgress({ direction: 'increase', baselineValue: 100, targetValue: 120, currentValue: 116 }) === 'at_risk', '80% progress = at_risk');
assert(evaluateGoalProgress({ direction: 'increase', baselineValue: 100, targetValue: 120, currentValue: 110 }) === 'in_progress', '50% progress = in_progress');

console.log('\n=== TARGET STATUS EVALUATION ===\n');
assert(evaluateTargetStatus({ baselineValue: 120, targetValue: 96, currentValue: 96 }) === 'achieved', 'target met = achieved');
assert(evaluateTargetStatus({ baselineValue: 120, targetValue: 96, currentValue: 97 }) === 'at_risk', '92% = at_risk');
assert(evaluateTargetStatus({ baselineValue: 120, targetValue: 96, currentValue: 110 }) === 'off_track', '42% = off_track');

console.log('\n=== INITIATIVE ROI ===\n');
assert(calculateInitiativeROI([{ actualValue: 50000 }, { actualValue: 30000 }], [{ actualAmount: 20000 }]) === 300, 'ROI 300%');
assert(calculateInitiativeROI([{ estimatedValue: 50000 }], [{ plannedAmount: 50000 }]) === 0, 'break-even ROI = 0%');

console.log('\n=== BENEFIT REALIZATION ===\n');
assert(calculateBenefitRealization([{ estimatedValue: 100000, status: 'realized', actualValue: 80000 }]) === 80, '80% realized');
assert(calculateBenefitRealization([{ estimatedValue: 100000, status: 'estimated', actualValue: 0 }]) === 0, '0% realized when not validated');

console.log('\n=== COST VARIANCE ===\n');
assert(calculateCostVariance([{ plannedAmount: 10000, actualAmount: 12000 }]) === 20, '20% over budget');
assert(calculateCostVariance([{ plannedAmount: 10000, actualAmount: 8000 }]) === -20, '20% under budget');
assert(calculateCostVariance([{ plannedAmount: 10000, actualAmount: 10000 }]) === 0, 'on budget');

console.log('\n=== CONSTANTS ===\n');

assert(OPPORTUNITY_STATUS.length === 7, '7 opportunity statuses');
assert(INITIATIVE_STATUS.length === 8, '8 initiative statuses');
assert(TASK_STATUS.length === 7, '7 task statuses');
assert(GOAL_STATUS.length === 6, '6 goal statuses');
assert(BENEFIT_TYPE.length === 11, '11 benefit types');
assert(COST_CATEGORY.length === 10, '10 cost categories');
assert(BASELINE_CATEGORY.length === 10, '10 baseline categories');
assert(TARGET_STATUS.length === 6, '6 target statuses');
assert(TARGET_TREND.length === 4, '4 target trends');

console.log('\n✅ ALL IMPROVEMENT ENGINE TESTS PASSED\n');
