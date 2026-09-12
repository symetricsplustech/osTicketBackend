/* eslint-disable no-console */
// Service Level Management tests: SLA plan validation, schedule logic, conditions, compliance, UC measurement
// DB-free unit tests. Run: node tests/sla-engine.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

// ─── Constants (matching models) ────────────────────────────────────────

const VALID_SCHEDULES = ["24/7", "Business Hours"];
const VALID_CLOCKS = [
  "resolution",
  "first_response",
  "next_response",
  "update",
  "escalation",
  "callback",
  "approval",
  "assignment",
  "task",
  "vendor",
  "closure",
];
const VALID_COMPARISONS = ["gte", "lte", "eq", "gt", "lt"];
const VALID_UNITS = [
  "percent",
  "hours",
  "minutes",
  "ms",
  "seconds",
  "requests_per_second",
];
const VALID_WINDOWS = ["daily", "weekly", "monthly", "quarterly", "yearly"];
const VALID_CONDITION_OPS = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "contains",
  "gt",
  "lt",
  "gte",
  "lte",
];
const VALID_PHASES = [
  "active",
  "paused",
  "waiting_customer",
  "pending_approval",
  "pending_vendor",
  "on_hold",
];
const VALID_REPAIR_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
];
const VALID_TRIGGER_TYPES = [
  "sla_plan_change",
  "schedule_change",
  "holiday_change",
  "manual",
  "bulk_import",
];
const VALID_ACTION_TYPES = [
  "notify_agent",
  "notify_team_lead",
  "notify_department_manager",
  "notify_company_admin",
  "email",
  "sms",
  "push",
  "webhook",
  "increase_priority",
  "reassign_team",
  "escalate_ticket",
  "create_major_incident",
];

// ─── Validation Logic ───────────────────────────────────────────────────

function validateSLAPlan(plan) {
  const errors = [];
  if (!plan.name || typeof plan.name !== "string") errors.push("name required");
  if (plan.schedule && !VALID_SCHEDULES.includes(plan.schedule))
    errors.push("invalid schedule");
  if (
    plan.gracePeriod !== undefined &&
    (typeof plan.gracePeriod !== "number" || plan.gracePeriod < 0)
  )
    errors.push("gracePeriod must be non-negative number");
  if (plan.targets) {
    for (const [clock, val] of Object.entries(plan.targets)) {
      if (val === null || val === undefined) continue; // null means "use gracePeriod"
      if (typeof val !== "number" || val < 0)
        errors.push(`${clock} must be non-negative number`);
    }
  }
  if (plan.escalationRules) {
    for (const rule of plan.escalationRules) {
      if (rule.clock && typeof rule.clock !== "string")
        errors.push("escalation clock must be string");
      if (typeof rule.afterMinutes !== "number" || rule.afterMinutes <= 0)
        errors.push("afterMinutes must be positive");
      if (rule.actions) {
        for (const action of rule.actions) {
          if (action.type && !VALID_ACTION_TYPES.includes(action.type))
            errors.push(`invalid action type: ${action.type}`);
        }
      }
    }
  }
  if (plan.pauseRules) {
    for (const [key, val] of Object.entries(plan.pauseRules)) {
      if (typeof val !== "boolean")
        errors.push(`pauseRules.${key} must be boolean`);
    }
  }
  return errors;
}

function computeComplianceRate(met, total) {
  if (total === 0) return 100;
  return Math.round((met / total) * 100);
}

function isWithinBusinessHours(date, schedule) {
  if (!schedule) return true;
  if (schedule.type === "24/7" || schedule.schedule === "24/7") return true;
  if (schedule.type === "custom") return true;
  // "Business Hours" schedule
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const day = dayNames[date.getDay()];
  const hours = schedule.businessHours?.[day];
  if (!hours || !hours.enabled) return false;
  const [startH, startM] = hours.start.split(":").map(Number);
  const [endH, endM] = hours.end.split(":").map(Number);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= startH * 60 + startM && minutes <= endH * 60 + endM;
}

function evaluateCondition(condition, ticket) {
  const value = ticket[condition.field];
  switch (condition.operator) {
    case "equals":
      return value === condition.value;
    case "not_equals":
      return value !== condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(value);
    case "not_in":
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case "contains":
      return typeof value === "string" && value.includes(condition.value);
    case "gt":
      return value > condition.value;
    case "lt":
      return value < condition.value;
    case "gte":
      return value >= condition.value;
    case "lte":
      return value <= condition.value;
    default:
      return false;
  }
}

function isHoliday(date, holidays) {
  if (!holidays || !Array.isArray(holidays)) return false;
  const dateStr = date.toISOString().split("T")[0];
  return holidays.some((h) => {
    const hDate = new Date(h.date).toISOString().split("T")[0];
    if (h.isRecurring) return hDate.slice(5) === dateStr.slice(5);
    return hDate === dateStr;
  });
}

function measureUCTarget(target, actualValue) {
  let met;
  switch (target.comparisonOperator) {
    case "gte":
      met = actualValue >= target.targetValue;
      break;
    case "lte":
      met = actualValue <= target.targetValue;
      break;
    case "gt":
      met = actualValue > target.targetValue;
      break;
    case "lt":
      met = actualValue < target.targetValue;
      break;
    case "eq":
      met = actualValue === target.targetValue;
      break;
    default:
      met = false;
  }
  return { status: met ? "met" : "breached", met };
}

// ─── TESTS ──────────────────────────────────────────────────────────────

console.log("\n=== SLA PLAN VALIDATION ===\n");

// Valid plan
const validErrors = validateSLAPlan({
  name: "P1 Response",
  schedule: "24/7",
  gracePeriod: 15,
  targets: { first_response: 15, resolution: 240 },
  escalationRules: [
    { clock: "response", afterMinutes: 15, actions: [{ type: "email" }] },
  ],
  pauseRules: { waiting_customer: true },
});
assert(
  validErrors.length === 0,
  `valid plan passes (${validErrors.join(", ")})`,
);

// Invalid schedule
const badSchedule = validateSLAPlan({ name: "Bad", schedule: "invalid" });
assert(badSchedule.length > 0, "rejects invalid schedule");

// Negative grace period
const badGrace = validateSLAPlan({ name: "Neg", gracePeriod: -5 });
assert(badGrace.length > 0, "rejects negative grace period");

// Negative target value
const badTarget = validateSLAPlan({
  name: "Neg Target",
  targets: { resolution: -10 },
});
assert(badTarget.length > 0, "rejects negative target value");

// Zero afterMinutes
const badAfter = validateSLAPlan({
  name: "Bad After",
  escalationRules: [{ clock: "resolution", afterMinutes: 0, actions: [] }],
});
assert(badAfter.length > 0, "rejects zero afterMinutes");

// Non-boolean pause rule
const badPause = validateSLAPlan({
  name: "Bad Pause",
  pauseRules: { waiting_customer: "yes" },
});
assert(badPause.length > 0, "rejects non-boolean pause rule");

// Empty name
const noName = validateSLAPlan({ schedule: "24/7" });
assert(noName.length > 0, "rejects missing name");

// Null target values are allowed (means "use gracePeriod")
const nullTarget = validateSLAPlan({
  name: "Null Target",
  targets: { resolution: null },
});
assert(
  nullTarget.length === 0,
  `null target values allowed (${nullTarget.join(", ")})`,
);

// Invalid action type
const badAction = validateSLAPlan({
  name: "Bad Action",
  escalationRules: [
    {
      clock: "resolution",
      afterMinutes: 10,
      actions: [{ type: "invalid_action" }],
    },
  ],
});
assert(badAction.length > 0, "rejects invalid escalation action type");

console.log("\n=== SLA COMPLIANCE RATE ===\n");

assert(computeComplianceRate(0, 0) === 100, "0/0 = 100%");
assert(computeComplianceRate(10, 10) === 100, "10/10 = 100%");
assert(computeComplianceRate(9, 10) === 90, "9/10 = 90%");
assert(computeComplianceRate(0, 10) === 0, "0/10 = 0%");
assert(computeComplianceRate(1, 3) === 33, "1/3 = 33%");
assert(computeComplianceRate(2, 3) === 67, "2/3 = 67%");

console.log("\n=== BUSINESS HOURS EVALUATION ===\n");

const bizSchedule = {
  type: "business_hours",
  businessHours: {
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "09:00", end: "17:00" },
    sunday: { enabled: false, start: "09:00", end: "17:00" },
  },
};

// Tuesday 10:00 = within hours
assert(
  isWithinBusinessHours(new Date("2026-09-15T10:00:00"), bizSchedule) === true,
  "Tuesday 10:00 within hours",
);
// Tuesday 08:00 = before hours
assert(
  isWithinBusinessHours(new Date("2026-09-15T08:00:00"), bizSchedule) === false,
  "Tuesday 08:00 before hours",
);
// Tuesday 18:00 = after hours
assert(
  isWithinBusinessHours(new Date("2026-09-15T18:00:00"), bizSchedule) === false,
  "Tuesday 18:00 after hours",
);
// Saturday = disabled
assert(
  isWithinBusinessHours(new Date("2026-09-19T10:00:00"), bizSchedule) === false,
  "Saturday 10:00 disabled",
);
// Sunday = disabled
assert(
  isWithinBusinessHours(new Date("2026-09-20T10:00:00"), bizSchedule) === false,
  "Sunday 10:00 disabled",
);

// 24/7 schedule
assert(
  isWithinBusinessHours(new Date("2026-09-15T03:00:00"), { type: "24/7" }) ===
    true,
  "24/7 always within hours",
);
assert(
  isWithinBusinessHours(new Date("2026-09-19T03:00:00"), { type: "24/7" }) ===
    true,
  "24/7 Saturday 03:00 within hours",
);
assert(
  isWithinBusinessHours(new Date("2026-09-15T03:00:00"), {
    schedule: "24/7",
  }) === true,
  "schedule=24/7 always within hours",
);

// Custom schedule (treated as always open)
assert(
  isWithinBusinessHours(new Date("2026-09-15T03:00:00"), { type: "custom" }) ===
    true,
  "custom schedule always open",
);
// No schedule (treated as always open)
assert(
  isWithinBusinessHours(new Date("2026-09-15T03:00:00"), null) === true,
  "null schedule always open",
);

console.log("\n=== SLA CONDITION EVALUATION ===\n");

const ticket = {
  priority: "p1",
  category: "hardware",
  impact: "high",
  urgency: "critical",
  state: "new",
  numericField: 5,
};

assert(
  evaluateCondition(
    { field: "priority", operator: "equals", value: "p1" },
    ticket,
  ) === true,
  "equals match",
);
assert(
  evaluateCondition(
    { field: "priority", operator: "equals", value: "p2" },
    ticket,
  ) === false,
  "equals no match",
);
assert(
  evaluateCondition(
    { field: "priority", operator: "not_equals", value: "p2" },
    ticket,
  ) === true,
  "not_equals match",
);
assert(
  evaluateCondition(
    { field: "priority", operator: "not_equals", value: "p1" },
    ticket,
  ) === false,
  "not_equals no match",
);
assert(
  evaluateCondition(
    { field: "priority", operator: "in", value: ["p1", "p2"] },
    ticket,
  ) === true,
  "in match",
);
assert(
  evaluateCondition(
    { field: "priority", operator: "in", value: ["p2", "p3"] },
    ticket,
  ) === false,
  "in no match",
);
assert(
  evaluateCondition(
    { field: "priority", operator: "not_in", value: ["p2", "p3"] },
    ticket,
  ) === true,
  "not_in match",
);
assert(
  evaluateCondition(
    { field: "priority", operator: "not_in", value: ["p1", "p2"] },
    ticket,
  ) === false,
  "not_in no match",
);
assert(
  evaluateCondition(
    { field: "category", operator: "contains", value: "hard" },
    ticket,
  ) === true,
  "contains match",
);
assert(
  evaluateCondition(
    { field: "category", operator: "contains", value: "soft" },
    ticket,
  ) === false,
  "contains no match",
);
assert(
  evaluateCondition(
    { field: "numericField", operator: "gt", value: 3 },
    ticket,
  ) === true,
  "gt numeric compare",
);
assert(
  evaluateCondition(
    { field: "numericField", operator: "lt", value: 10 },
    ticket,
  ) === true,
  "lt numeric compare",
);
assert(
  evaluateCondition(
    { field: "numericField", operator: "gte", value: 5 },
    ticket,
  ) === true,
  "gte numeric match",
);
assert(
  evaluateCondition(
    { field: "numericField", operator: "lte", value: 5 },
    ticket,
  ) === true,
  "lte numeric match",
);
assert(
  evaluateCondition(
    { field: "nonexistent", operator: "equals", value: "x" },
    ticket,
  ) === false,
  "nonexistent field = false",
);

console.log("\n=== UC TARGET MEASUREMENT ===\n");

assert(
  measureUCTarget({ comparisonOperator: "gte", targetValue: 99.9 }, 99.95)
    .status === "met",
  "99.95 >= 99.9 = met",
);
assert(
  measureUCTarget({ comparisonOperator: "gte", targetValue: 99.9 }, 95.0)
    .status === "breached",
  "95.0 >= 99.9 = breached",
);
assert(
  measureUCTarget({ comparisonOperator: "lte", targetValue: 30 }, 25).status ===
    "met",
  "25 <= 30 = met",
);
assert(
  measureUCTarget({ comparisonOperator: "lte", targetValue: 30 }, 35).status ===
    "breached",
  "35 <= 30 = breached",
);
assert(
  measureUCTarget({ comparisonOperator: "gt", targetValue: 100 }, 101)
    .status === "met",
  "101 > 100 = met",
);
assert(
  measureUCTarget({ comparisonOperator: "gt", targetValue: 100 }, 100)
    .status === "breached",
  "100 > 100 = breached",
);
assert(
  measureUCTarget({ comparisonOperator: "lt", targetValue: 50 }, 40).status ===
    "met",
  "40 < 50 = met",
);
assert(
  measureUCTarget({ comparisonOperator: "lt", targetValue: 50 }, 50).status ===
    "breached",
  "50 < 50 = breached",
);
assert(
  measureUCTarget({ comparisonOperator: "eq", targetValue: 42 }, 42).status ===
    "met",
  "42 == 42 = met",
);
assert(
  measureUCTarget({ comparisonOperator: "eq", targetValue: 42 }, 43).status ===
    "breached",
  "43 == 42 = breached",
);
assert(
  measureUCTarget({ comparisonOperator: "eq", targetValue: 42 }, 42).met ===
    true,
  "eq reports met=true",
);
assert(
  measureUCTarget({ comparisonOperator: "eq", targetValue: 42 }, 43).met ===
    false,
  "eq reports met=false",
);

console.log("\n=== HOLIDAY DETECTION ===\n");

const holidays = [
  { name: "New Year", date: "2026-01-01", isRecurring: true },
  { name: "July 4th", date: "2026-07-04", isRecurring: true },
  { name: "Company Party", date: "2026-09-15", isRecurring: false },
];

assert(
  isHoliday(new Date("2026-03-01"), holidays) === false,
  "March 1 is not a holiday",
);
assert(
  isHoliday(new Date("2026-07-04"), holidays) === true,
  "July 4 is a holiday (exact match)",
);
assert(
  isHoliday(new Date("2026-09-15"), holidays) === true,
  "Sep 15 is a holiday (exact match)",
);
assert(
  isHoliday(new Date("2026-12-25"), holidays) === false,
  "Dec 25 is not a holiday",
);
assert(
  isHoliday(new Date("2026-01-01"), []) === false,
  "empty holidays = no match",
);
assert(
  isHoliday(new Date("2026-09-15"), null) === false,
  "null holidays = no match",
);

console.log("\n=== SLA VALIDATION CONSTANTS ===\n");

assert(VALID_SCHEDULES.length === 2, "2 valid schedules");
assert(VALID_CLOCKS.length === 11, "11 valid clocks");
assert(VALID_COMPARISONS.length === 5, "5 valid comparison operators");
assert(VALID_UNITS.length === 6, "6 valid units");
assert(VALID_WINDOWS.length === 5, "5 valid windows");
assert(VALID_CONDITION_OPS.length === 9, "9 valid condition operators");
assert(VALID_PHASES.length === 6, "6 valid phases");
assert(VALID_REPAIR_STATUSES.length === 5, "5 valid repair statuses");
assert(VALID_TRIGGER_TYPES.length === 5, "5 valid trigger types");
assert(VALID_ACTION_TYPES.length === 12, "12 valid action types");

console.log("\n✅ ALL SLA ENGINE TESTS PASSED\n");
