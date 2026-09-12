/* eslint-disable no-console */
// Major Incident + Communications tests: state machine, cadence, templates, stakeholders, bridge
// DB-free unit tests. Run: node tests/major-incident-engine.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

// ─── Constants ──────────────────────────────────────────────────────────

const MAJOR_STATUS = ["candidate", "declared", "rejected", "demoted"];
const CANDIDATE_STATUS = ["pending", "approved", "rejected"];
const PARTICIPANT_ROLE = [
  "commander",
  "technical_lead",
  "communications",
  "subject_matter_expert",
  "stakeholder",
  "coordinator",
  "resolver",
  "observer",
];
const STAKEHOLDER_ROLE = [
  "executive",
  "customer",
  "vendor",
  "partner",
  "regulator",
  "internal",
  "media",
  "other",
];
const COMM_TYPE = [
  "internal",
  "external",
  "stakeholder",
  "executive",
  "resolution",
  "escalation",
];
const COMM_CHANNEL = [
  "email",
  "sms",
  "slack",
  "teams",
  "webhook",
  "push",
  "voice",
  "bridge",
];
const TASK_STATUS = [
  "pending",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
];
const BRIDGE_PROVIDER = [
  "zoom",
  "teams",
  "webex",
  "google_meet",
  "custom",
  "voice",
];
const BRIDGE_STATUS = ["scheduled", "active", "ended", "cancelled"];
const TIMELINE_EVENT_TYPE = [
  "status_change",
  "communication",
  "decision",
  "action",
  "milestone",
  "note",
  "escalation",
];
const VISIBILITY = ["internal", "external", "stakeholder"];
const ROOT_CAUSE_CATEGORY = [
  "code_defect",
  "configuration",
  "infrastructure",
  "third_party",
  "process_gap",
  "human_error",
  "unknown",
];
const PIR_STATUS = ["draft", "in_review", "approved", "published"];

// ─── State Machine ──────────────────────────────────────────────────────

const MAJOR_TRANSITIONS = {
  candidate: ["declared", "rejected"],
  declared: ["demoted"],
  rejected: [],
  demoted: ["declared"],
};

const CANDIDATE_TRANSITIONS = {
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

// ─── Validation Logic ───────────────────────────────────────────────────

function validateMajorIncident(mi) {
  const errors = [];
  if (!mi.incident) errors.push("incident required");
  if (mi.status && !MAJOR_STATUS.includes(mi.status))
    errors.push("invalid status");
  if (
    mi.majorType &&
    !["outage", "degradation", "security", "data_breach", "other"].includes(
      mi.majorType,
    )
  )
    errors.push("invalid majorType");
  if (mi.communicationPlan) {
    const cp = mi.communicationPlan;
    if (
      cp.internal &&
      typeof cp.internal.cadenceMinutes === "number" &&
      cp.internal.cadenceMinutes < 1
    )
      errors.push("internal cadence >= 1");
    if (
      cp.external &&
      typeof cp.external.cadenceMinutes === "number" &&
      cp.external.cadenceMinutes < 1
    )
      errors.push("external cadence >= 1");
  }
  return errors;
}

function validateCandidate(c) {
  const errors = [];
  if (!c.incident) errors.push("incident required");
  if (!c.nominatedBy) errors.push("nominatedBy required");
  if (c.status && !CANDIDATE_STATUS.includes(c.status))
    errors.push("invalid status");
  return errors;
}

function validateStakeholder(s) {
  const errors = [];
  if (!s.name) errors.push("name required");
  if (!s.majorIncidentId) errors.push("majorIncidentId required");
  if (s.role && !STAKEHOLDER_ROLE.includes(s.role)) errors.push("invalid role");
  if (
    s.notificationCadence &&
    !["realtime", "every_15m", "every_30m", "hourly", "on_change"].includes(
      s.notificationCadence,
    )
  )
    errors.push("invalid cadence");
  return errors;
}

function validateTemplate(t) {
  const errors = [];
  if (!t.name) errors.push("name required");
  if (!t.type || !COMM_TYPE.includes(t.type)) errors.push("invalid type");
  if (!t.subject) errors.push("subject required");
  if (!t.body) errors.push("body required");
  if (t.channel && !COMM_CHANNEL.includes(t.channel))
    errors.push("invalid channel");
  return errors;
}

function validateBridge(b) {
  const errors = [];
  if (!b.majorIncidentId) errors.push("majorIncidentId required");
  if (b.provider && !BRIDGE_PROVIDER.includes(b.provider))
    errors.push("invalid provider");
  if (b.status && !BRIDGE_STATUS.includes(b.status))
    errors.push("invalid status");
  return errors;
}

function validateCommunicationTask(t) {
  const errors = [];
  if (!t.majorIncidentId) errors.push("majorIncidentId required");
  if (!t.type || !COMM_TYPE.includes(t.type)) errors.push("invalid type");
  const VALID_AUDIENCE = [
    "internal",
    "external",
    "customer",
    "stakeholder",
    "executive",
    "vendor",
    "media",
    "all",
  ];
  if (!t.audience) errors.push("audience required");
  else if (!VALID_AUDIENCE.includes(t.audience))
    errors.push("invalid audience");
  if (!t.body) errors.push("body required");
  if (t.channel && !COMM_CHANNEL.includes(t.channel))
    errors.push("invalid channel");
  if (t.status && !TASK_STATUS.includes(t.status))
    errors.push("invalid status");
  return errors;
}

// ─── Cadence Calculation ────────────────────────────────────────────────

function computeNextCadence(lastAt, cadenceMinutes) {
  if (!lastAt) return new Date();
  return new Date(new Date(lastAt).getTime() + cadenceMinutes * 60000);
}

function isCadenceDue(nextAt) {
  if (!nextAt) return false;
  return new Date(nextAt) <= new Date();
}

// ─── Template Variable Substitution ───────────────────────────────────

function substituteTemplate(template, variables = {}) {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => variables[key] || match,
  );
}

// ─── TESTS ─────────────────────────────────────────────────────────────

console.log("\n=== MAJOR INCIDENT STATE MACHINE ===\n");

assert(
  canTransition("candidate", "declared", MAJOR_TRANSITIONS) === true,
  "candidate->declared",
);
assert(
  canTransition("candidate", "rejected", MAJOR_TRANSITIONS) === true,
  "candidate->rejected",
);
assert(
  canTransition("declared", "demoted", MAJOR_TRANSITIONS) === true,
  "declared->demoted",
);
assert(
  canTransition("demoted", "declared", MAJOR_TRANSITIONS) === true,
  "demoted->declared (re-declare)",
);
assert(
  canTransition("declared", "declared", MAJOR_TRANSITIONS) === false,
  "declared->declared blocked",
);
assert(
  canTransition("rejected", "declared", MAJOR_TRANSITIONS) === false,
  "rejected->declared blocked",
);

console.log("\n=== CANDIDATE STATE MACHINE ===\n");

assert(
  canTransition("pending", "approved", CANDIDATE_TRANSITIONS) === true,
  "pending->approved",
);
assert(
  canTransition("pending", "rejected", CANDIDATE_TRANSITIONS) === true,
  "pending->rejected",
);
assert(
  canTransition("approved", "rejected", CANDIDATE_TRANSITIONS) === false,
  "approved->rejected blocked",
);

console.log("\n=== VALIDATION: MAJOR INCIDENT ===\n");

assert(
  validateMajorIncident({ incident: "id1" }).length === 0,
  "valid major incident passes",
);
assert(
  validateMajorIncident({ incident: "id1", status: "declared" }).length === 0,
  "valid status passes",
);
assert(
  validateMajorIncident({ incident: "id1", status: "invalid" }).length > 0,
  "invalid status rejected",
);
assert(
  validateMajorIncident({ incident: "id1", majorType: "outage" }).length === 0,
  "valid majorType passes",
);
assert(
  validateMajorIncident({ incident: "id1", majorType: "invalid" }).length > 0,
  "invalid majorType rejected",
);
assert(
  validateMajorIncident({
    incident: "id1",
    communicationPlan: { internal: { cadenceMinutes: 30 } },
  }).length === 0,
  "valid cadence passes",
);
assert(
  validateMajorIncident({
    incident: "id1",
    communicationPlan: { internal: { cadenceMinutes: 0 } },
  }).length > 0,
  "cadence < 1 rejected",
);

console.log("\n=== VALIDATION: CANDIDATE ===\n");

assert(
  validateCandidate({ incident: "id1", nominatedBy: "user1" }).length === 0,
  "valid candidate passes",
);
assert(
  validateCandidate({
    incident: "id1",
    nominatedBy: "user1",
    status: "pending",
  }).length === 0,
  "pending status passes",
);
assert(
  validateCandidate({ incident: "id1", status: "invalid" }).length > 0,
  "invalid status rejected",
);

console.log("\n=== VALIDATION: STAKEHOLDER ===\n");

assert(
  validateStakeholder({
    name: "John",
    majorIncidentId: "mi1",
    role: "executive",
  }).length === 0,
  "valid stakeholder passes",
);
assert(
  validateStakeholder({ name: "John", majorIncidentId: "mi1", role: "invalid" })
    .length > 0,
  "invalid role rejected",
);
assert(
  validateStakeholder({
    name: "John",
    majorIncidentId: "mi1",
    notificationCadence: "hourly",
  }).length === 0,
  "valid cadence passes",
);
assert(
  validateStakeholder({
    name: "John",
    majorIncidentId: "mi1",
    notificationCadence: "invalid",
  }).length > 0,
  "invalid cadence rejected",
);

console.log("\n=== VALIDATION: COMMUNICATION TEMPLATE ===\n");

assert(
  validateTemplate({
    name: "Internal",
    type: "internal",
    subject: "Update",
    body: "Hi",
  }).length === 0,
  "valid template passes",
);
assert(
  validateTemplate({
    name: "Internal",
    type: "invalid",
    subject: "Update",
    body: "Hi",
  }).length > 0,
  "invalid type rejected",
);
assert(
  validateTemplate({
    name: "Internal",
    type: "internal",
    subject: "",
    body: "Hi",
  }).length > 0,
  "empty subject rejected",
);
assert(
  validateTemplate({
    name: "Internal",
    type: "internal",
    subject: "Update",
    body: "",
  }).length > 0,
  "empty body rejected",
);
assert(
  validateTemplate({
    name: "Internal",
    type: "internal",
    subject: "Update",
    body: "Hi",
    channel: "email",
  }).length === 0,
  "valid channel passes",
);
assert(
  validateTemplate({
    name: "Internal",
    type: "internal",
    subject: "Update",
    body: "Hi",
    channel: "invalid",
  }).length > 0,
  "invalid channel rejected",
);

console.log("\n=== VALIDATION: BRIDGE SESSION ===\n");

assert(
  validateBridge({ majorIncidentId: "mi1", provider: "zoom" }).length === 0,
  "valid bridge passes",
);
assert(
  validateBridge({ majorIncidentId: "mi1", provider: "invalid" }).length > 0,
  "invalid provider rejected",
);
assert(
  validateBridge({ majorIncidentId: "mi1", status: "active" }).length === 0,
  "valid status passes",
);
assert(
  validateBridge({ majorIncidentId: "mi1", status: "invalid" }).length > 0,
  "invalid status rejected",
);

console.log("\n=== VALIDATION: COMMUNICATION TASK ===\n");

assert(
  validateCommunicationTask({
    majorIncidentId: "mi1",
    type: "internal",
    audience: "internal",
    body: "Test",
  }).length === 0,
  "valid task passes",
);
assert(
  validateCommunicationTask({
    majorIncidentId: "mi1",
    type: "invalid",
    audience: "internal",
    body: "Test",
  }).length > 0,
  "invalid type rejected",
);
assert(
  validateCommunicationTask({
    majorIncidentId: "mi1",
    type: "internal",
    audience: "invalid",
    body: "Test",
  }).length > 0,
  "invalid audience rejected",
);
assert(
  validateCommunicationTask({
    majorIncidentId: "mi1",
    type: "internal",
    audience: "internal",
    body: "",
    channel: "email",
  }).length > 0,
  "empty body rejected",
);
assert(
  validateCommunicationTask({
    majorIncidentId: "mi1",
    type: "internal",
    audience: "internal",
    body: "Test",
    status: "sent",
  }).length === 0,
  "valid status passes",
);
assert(
  validateCommunicationTask({
    majorIncidentId: "mi1",
    type: "internal",
    audience: "internal",
    body: "Test",
    status: "invalid",
  }).length > 0,
  "invalid status rejected",
);

console.log("\n=== CADENCE CALCULATION ===\n");

const base = new Date("2026-01-01T10:00:00");
assert(
  computeNextCadence(base, 30).getTime() ===
    new Date("2026-01-01T10:30:00").getTime(),
  "30 min cadence",
);
assert(
  computeNextCadence(base, 60).getTime() ===
    new Date("2026-01-01T11:00:00").getTime(),
  "60 min cadence",
);
assert(
  computeNextCadence(null, 30).getTime() <= Date.now(),
  "null lastAt = now",
);

const future = new Date(Date.now() + 3600000);
const past = new Date(Date.now() - 3600000);
assert(isCadenceDue(future) === false, "future not due");
assert(isCadenceDue(past) === true, "past is due");
assert(isCadenceDue(null) === false, "null not due");

console.log("\n=== TEMPLATE SUBSTITUTION ===\n");

assert(
  substituteTemplate("Hello {{name}}", { name: "John" }) === "Hello John",
  "simple substitution",
);
assert(
  substituteTemplate("{{greeting}} {{name}}", {
    greeting: "Hi",
    name: "Jane",
  }) === "Hi Jane",
  "multiple substitutions",
);
assert(
  substituteTemplate("Hello {{missing}}", { name: "John" }) ===
    "Hello {{missing}}",
  "missing variable preserved",
);
assert(
  substituteTemplate("No vars here", {}) === "No vars here",
  "no variables unchanged",
);

console.log("\n=== CONSTANTS VALIDATION ===\n");

assert(MAJOR_STATUS.length === 4, "4 major statuses");
assert(CANDIDATE_STATUS.length === 3, "3 candidate statuses");
assert(PARTICIPANT_ROLE.length === 8, "8 participant roles");
assert(STAKEHOLDER_ROLE.length === 8, "8 stakeholder roles");
assert(COMM_TYPE.length === 6, "6 communication types");
assert(COMM_CHANNEL.length === 8, "8 communication channels");
assert(TASK_STATUS.length === 6, "6 task statuses");
assert(BRIDGE_PROVIDER.length === 6, "6 bridge providers");
assert(BRIDGE_STATUS.length === 4, "4 bridge statuses");
assert(TIMELINE_EVENT_TYPE.length === 7, "7 timeline event types");
assert(VISIBILITY.length === 3, "3 visibility levels");
assert(ROOT_CAUSE_CATEGORY.length === 7, "7 root cause categories");
assert(PIR_STATUS.length === 4, "4 PIR statuses");

console.log("\n✅ ALL MAJOR INCIDENT ENGINE TESTS PASSED\n");
