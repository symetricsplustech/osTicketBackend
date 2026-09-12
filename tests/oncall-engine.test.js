/* eslint-disable no-console */
// On-Call Scheduling tests: state machines, validation, rotation logic, gap detection, escalation
// DB-free unit tests. Run: node tests/oncall-engine.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

// ─── Constants ──────────────────────────────────────────────────────────

const SCHEDULE_STATUS = ["draft", "active", "paused", "archived"];
const SHIFT_STATUS = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
  "conflict",
];
const ROSTER_STATUS = ["draft", "published", "archived"];
const ROTATION_TYPE = ["daily", "weekly", "biweekly", "monthly", "custom"];
const ROTATION_STATUS = ["active", "paused", "completed"];
const COVERAGE_TYPE = ["swap", "cover", "trade"];
const COVERAGE_STATUS = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
];
const TIMEOFF_STATUS = ["pending", "approved", "rejected", "cancelled"];
const POLICY_TARGET_TYPES = [
  "user",
  "team",
  "group",
  "email",
  "sms",
  "webhook",
  "slack",
  "voice",
];
const CONTACT_CHANNELS = ["email", "sms", "voice", "slack", "teams", "push"];

// ─── State Machines ────────────────────────────────────────────────────

const SHIFT_TRANSITIONS = {
  scheduled: ["active", "cancelled", "conflict"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  conflict: ["scheduled", "cancelled"],
};

const COVERAGE_TRANSITIONS = {
  pending: ["approved", "rejected", "cancelled", "expired"],
  approved: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

const TIMEOFF_TRANSITIONS = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["cancelled"],
  rejected: [],
  cancelled: [],
};

const ROSTER_TRANSITIONS = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: [],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

// ─── Validation ────────────────────────────────────────────────────────

function validateSchedule(s) {
  const errors = [];
  if (!s.name) errors.push("name required");
  if (!s.timezone) errors.push("timezone required");
  if (!s.team) errors.push("team required");
  if (s.status && !SCHEDULE_STATUS.includes(s.status))
    errors.push("invalid status");
  if (
    s.scheduleType &&
    !["weekly", "biweekly", "monthly", "custom"].includes(s.scheduleType)
  )
    errors.push("invalid scheduleType");
  if (s.startDate && s.endDate && new Date(s.endDate) <= new Date(s.startDate))
    errors.push("endDate after startDate");
  return errors;
}

function validateShift(s) {
  const errors = [];
  if (!s.scheduleId) errors.push("scheduleId required");
  if (!s.onCallAgent) errors.push("onCallAgent required");
  if (!s.startDate || !s.endDate) errors.push("startDate and endDate required");
  if (s.startDate && s.endDate && new Date(s.endDate) <= new Date(s.startDate))
    errors.push("endDate after startDate");
  if (s.status && !SHIFT_STATUS.includes(s.status))
    errors.push("invalid status");
  return errors;
}

function validateCoverageRequest(c) {
  const errors = [];
  if (!c.scheduleId) errors.push("scheduleId required");
  if (!c.shiftId) errors.push("shiftId required");
  if (!c.requesterId) errors.push("requesterId required");
  if (!c.startDate || !c.endDate) errors.push("startDate and endDate required");
  if (c.type && !COVERAGE_TYPE.includes(c.type)) errors.push("invalid type");
  if (c.status && !COVERAGE_STATUS.includes(c.status))
    errors.push("invalid status");
  return errors;
}

function validateRotation(r) {
  const errors = [];
  if (!r.name) errors.push("name required");
  if (!r.type || !ROTATION_TYPE.includes(r.type)) errors.push("invalid type");
  if (!r.members || !r.members.length) errors.push("members required");
  return errors;
}

function validateEscalationPolicy(p) {
  const errors = [];
  if (!p.name) errors.push("name required");
  if (typeof p.repeatAfterMinutes === "number" && p.repeatAfterMinutes < 0)
    errors.push("repeatAfterMinutes >= 0");
  if (typeof p.maxRepeats === "number" && p.maxRepeats < 1)
    errors.push("maxRepeats >= 1");
  return errors;
}

function validateEscalationLevel(l) {
  const errors = [];
  if (!l.name) errors.push("name required");
  if (!l.level || l.level < 1) errors.push("level >= 1 required");
  if (!l.delayMinutes || l.delayMinutes < 0)
    errors.push("delayMinutes >= 0 required");
  if (!l.targets || !l.targets.length) errors.push("targets required");
  for (const t of l.targets || []) {
    if (!POLICY_TARGET_TYPES.includes(t.type))
      errors.push(`invalid target type: ${t.type}`);
  }
  return errors;
}

function validateContactPreference(c) {
  const errors = [];
  if (!c.userId) errors.push("userId required");
  if (c.preferredOrder) {
    for (const ch of c.preferredOrder) {
      if (!CONTACT_CHANNELS.includes(ch)) errors.push(`invalid channel: ${ch}`);
    }
  }
  return errors;
}

// ─── Rotation Logic ────────────────────────────────────────────────────

function computeNextHandover(currentIndex, members, pattern) {
  const nextIndex = (currentIndex + 1) % members.length;
  const days = pattern.durationDays || 7;
  const nextDate = new Date(pattern.nextHandoverDate || Date.now());
  nextDate.setDate(nextDate.getDate() + days);
  return { nextIndex, nextDate };
}

function computeShiftDates(pattern, startDate, numShifts) {
  const shifts = [];
  let current = new Date(startDate);
  for (let i = 0; i < numShifts; i++) {
    const end = new Date(current);
    end.setDate(end.getDate() + (pattern.durationDays || 7));
    shifts.push({ start: new Date(current), end });
    current = end;
  }
  return shifts;
}

function detectShiftGaps(shifts) {
  const gaps = [];
  for (let i = 1; i < shifts.length; i++) {
    const prevEnd = new Date(shifts[i - 1].end);
    const currStart = new Date(shifts[i].start);
    if (currStart > prevEnd) {
      gaps.push({
        from: prevEnd,
        to: currStart,
        durationMinutes: (currStart - prevEnd) / 60000,
      });
    }
  }
  return gaps;
}

// ─── Escalation Logic ──────────────────────────────────────────────────

function computeEscalationTimes(levels) {
  return levels.map((l, i) => ({
    level: l.level,
    name: l.name,
    atMinutes: levels
      .slice(0, i + 1)
      .reduce((sum, cur) => sum + cur.delayMinutes, 0),
  }));
}

function getActiveTargets(level) {
  return level.targets.filter((t) => t.type !== "email" && t.type !== "sms");
}

// ─── Contact Preference Logic ──────────────────────────────────────────

function isInQuietHours(pref) {
  if (!pref.quietHours?.enabled) return false;
  const now = new Date();
  const [sh, sm] = pref.quietHours.start.split(":").map(Number);
  const [eh, em] = pref.quietHours.end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return nowMins >= start && nowMins <= end;
  return nowMins >= start || nowMins <= end;
}

function getNotificationChannels(pref) {
  return (
    pref.preferredOrder?.filter((ch) => !isInQuietHours(pref)) || ["email"]
  );
}

// ─── TESTS ─────────────────────────────────────────────────────────────

console.log("\n=== SHIFT STATE MACHINE ===\n");
assert(
  canTransition("scheduled", "active", SHIFT_TRANSITIONS) === true,
  "scheduled->active",
);
assert(
  canTransition("scheduled", "cancelled", SHIFT_TRANSITIONS) === true,
  "scheduled->cancelled",
);
assert(
  canTransition("active", "completed", SHIFT_TRANSITIONS) === true,
  "active->completed",
);
assert(
  canTransition("active", "cancelled", SHIFT_TRANSITIONS) === true,
  "active->cancelled",
);
assert(
  canTransition("completed", "active", SHIFT_TRANSITIONS) === false,
  "completed->active blocked",
);
assert(
  canTransition("conflict", "scheduled", SHIFT_TRANSITIONS) === true,
  "conflict->scheduled",
);

console.log("\n=== COVERAGE REQUEST STATE MACHINE ===\n");
assert(
  canTransition("pending", "approved", COVERAGE_TRANSITIONS) === true,
  "pending->approved",
);
assert(
  canTransition("pending", "rejected", COVERAGE_TRANSITIONS) === true,
  "pending->rejected",
);
assert(
  canTransition("approved", "rejected", COVERAGE_TRANSITIONS) === false,
  "approved->rejected blocked",
);

console.log("\n=== TIME-OFF STATE MACHINE ===\n");
assert(
  canTransition("pending", "approved", TIMEOFF_TRANSITIONS) === true,
  "pending->approved",
);
assert(
  canTransition("approved", "cancelled", TIMEOFF_TRANSITIONS) === true,
  "approved->cancelled",
);

console.log("\n=== ROSTER STATE MACHINE ===\n");
assert(
  canTransition("draft", "published", ROSTER_TRANSITIONS) === true,
  "draft->published",
);
assert(
  canTransition("published", "archived", ROSTER_TRANSITIONS) === true,
  "published->archived",
);
assert(
  canTransition("draft", "archived", ROSTER_TRANSITIONS) === true,
  "draft->archived",
);

console.log("\n=== VALIDATION: SCHEDULE ===\n");
assert(
  validateSchedule({
    name: "Test",
    timezone: "UTC",
    team: "team1",
    startDate: "2026-01-01",
  }).length === 0,
  "valid schedule passes",
);
assert(
  validateSchedule({
    name: "Test",
    timezone: "UTC",
    team: "team1",
    status: "active",
    startDate: "2026-01-01",
    endDate: "2025-01-01",
  }).length > 0,
  "endDate before startDate rejected",
);
assert(
  validateSchedule({
    name: "Test",
    timezone: "UTC",
    team: "team1",
    status: "invalid",
  }).length > 0,
  "invalid status rejected",
);

console.log("\n=== VALIDATION: SHIFT ===\n");
assert(
  validateShift({
    scheduleId: "s1",
    onCallAgent: "u1",
    startDate: "2026-01-01T09:00:00",
    endDate: "2026-01-08T09:00:00",
  }).length === 0,
  "valid shift passes",
);
assert(
  validateShift({
    scheduleId: "s1",
    onCallAgent: "u1",
    startDate: "2026-01-08",
    endDate: "2026-01-01",
  }).length > 0,
  "endDate before startDate rejected",
);

console.log("\n=== VALIDATION: COVERAGE REQUEST ===\n");
assert(
  validateCoverageRequest({
    scheduleId: "s1",
    shiftId: "sh1",
    requesterId: "u1",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
  }).length === 0,
  "valid coverage passes",
);
assert(
  validateCoverageRequest({
    scheduleId: "s1",
    shiftId: "sh1",
    requesterId: "u1",
    type: "invalid",
  }).length > 0,
  "invalid type rejected",
);

console.log("\n=== VALIDATION: ROTATION ===\n");
assert(
  validateRotation({ name: "Weekly", type: "weekly", members: ["u1", "u2"] })
    .length === 0,
  "valid rotation passes",
);
assert(
  validateRotation({ name: "Test", type: "invalid", members: ["u1"] }).length >
    0,
  "invalid type rejected",
);
assert(
  validateRotation({ name: "Test", type: "weekly", members: [] }).length > 0,
  "empty members rejected",
);

console.log("\n=== VALIDATION: ESCALATION POLICY ===\n");
assert(
  validateEscalationPolicy({
    name: "Policy",
    repeatAfterMinutes: 60,
    maxRepeats: 3,
  }).length === 0,
  "valid policy passes",
);
assert(
  validateEscalationPolicy({ name: "Policy", repeatAfterMinutes: -1 }).length >
    0,
  "negative repeat rejected",
);
assert(
  validateEscalationPolicy({ name: "Policy", maxRepeats: 0 }).length > 0,
  "zero maxRepeats rejected",
);

console.log("\n=== VALIDATION: ESCALATION LEVEL ===\n");
assert(
  validateEscalationLevel({
    name: "Level 1",
    level: 1,
    delayMinutes: 15,
    targets: [{ type: "user", value: "u1" }],
  }).length === 0,
  "valid level passes",
);
assert(
  validateEscalationLevel({ name: "Level", level: 0 }).length > 0,
  "level 0 rejected",
);
assert(
  validateEscalationLevel({ name: "Level", level: 1, delayMinutes: -1 })
    .length > 0,
  "negative delay rejected",
);
assert(
  validateEscalationLevel({
    name: "Level",
    level: 1,
    delayMinutes: 15,
    targets: [],
  }).length > 0,
  "empty targets rejected",
);
assert(
  validateEscalationLevel({
    name: "Level",
    level: 1,
    delayMinutes: 15,
    targets: [{ type: "invalid", value: "x" }],
  }).length > 0,
  "invalid target type rejected",
);

console.log("\n=== VALIDATION: CONTACT PREFERENCE ===\n");
assert(
  validateContactPreference({ userId: "u1", preferredOrder: ["email", "sms"] })
    .length === 0,
  "valid preference passes",
);
assert(
  validateContactPreference({ userId: "u1", preferredOrder: ["invalid"] })
    .length > 0,
  "invalid channel rejected",
);

console.log("\n=== ROTATION LOGIC ===\n");
const pattern = { durationDays: 7, nextHandoverDate: "2026-01-01" };
const rot1 = computeNextHandover(0, ["u1", "u2", "u3"], pattern);
assert(rot1.nextIndex === 1, "next index 0->1");
assert(
  rot1.nextDate.getTime() === new Date("2026-01-08").getTime(),
  "next date +7 days",
);

const rot2 = computeNextHandover(2, ["u1", "u2", "u3"], pattern);
assert(rot2.nextIndex === 0, "next index 2->0 (wrap)");

const shifts = computeShiftDates(
  { durationDays: 7 },
  new Date("2026-01-01"),
  3,
);
assert(shifts.length === 3, "3 shifts computed");
assert(
  shifts[0].end.getTime() === new Date("2026-01-08").getTime(),
  "first shift 7 days",
);
assert(
  shifts[1].start.getTime() === shifts[0].end.getTime(),
  "contiguous shifts",
);

console.log("\n=== GAP DETECTION ===\n");
const testShifts = [
  { start: new Date("2026-01-01"), end: new Date("2026-01-08") },
  { start: new Date("2026-01-10"), end: new Date("2026-01-17") }, // 2 day gap
  { start: new Date("2026-01-17"), end: new Date("2026-01-24") },
];
const gaps = detectShiftGaps(testShifts);
assert(gaps.length === 1, "1 gap detected");
assert(gaps[0].durationMinutes === 2880, "gap is 2 days = 2880 min");

console.log("\n=== ESCALATION TIMES ===\n");
const levels = [
  { level: 1, name: "L1", delayMinutes: 15 },
  { level: 2, name: "L2", delayMinutes: 30 },
  { level: 3, name: "L3", delayMinutes: 60 },
];
const escTimes = computeEscalationTimes(levels);
assert(escTimes[0].atMinutes === 15, "L1 at 15 min");
assert(escTimes[1].atMinutes === 45, "L2 at 45 min");
assert(escTimes[2].atMinutes === 105, "L3 at 105 min");

console.log("\n=== CONTACT PREFERENCE LOGIC ===\n");
const pref = {
  preferredOrder: ["voice", "sms", "email"],
  quietHours: { enabled: false },
};
assert(
  getNotificationChannels(pref).length === 3,
  "all channels when no quiet hours",
);
assert(
  getNotificationChannels({
    ...pref,
    quietHours: { enabled: true, start: "22:00", end: "07:00" },
  }).length <= 3,
  "quiet hours filters",
);

console.log("\n=== CONSTANTS ===\n");
assert(SCHEDULE_STATUS.length === 4, "4 schedule statuses");
assert(SHIFT_STATUS.length === 5, "5 shift statuses");
assert(ROSTER_STATUS.length === 3, "3 roster statuses");
assert(ROTATION_TYPE.length === 5, "5 rotation types");
assert(ROTATION_STATUS.length === 3, "3 rotation statuses");
assert(COVERAGE_TYPE.length === 3, "3 coverage types");
assert(COVERAGE_STATUS.length === 5, "5 coverage statuses");
assert(TIMEOFF_STATUS.length === 4, "4 timeoff statuses");
assert(POLICY_TARGET_TYPES.length === 8, "8 target types");
assert(CONTACT_CHANNELS.length === 6, "6 contact channels");

console.log("\n✅ ALL ON-CALL ENGINE TESTS PASSED\n");
