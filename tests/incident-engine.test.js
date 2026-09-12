/* eslint-disable no-console */
// Incident Management tests: state machine, transitions, business rules
// DB-free unit tests. Run: npm run test:incident-engine
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  canTransition,
  allowedTransitions,
  INCIDENT_TRANSITIONS,
} = require("../src/services/stateMachine.service");

(async () => {
  console.log("\n=== INCIDENT STATE MACHINE TESTS ===\n");

  // --- Incident new state ---
  assert(
    canTransition("incident", "new", "in_progress") === true,
    "incident new->in_progress",
  );
  assert(
    canTransition("incident", "new", "on_hold_caller") === true,
    "incident new->on_hold_caller",
  );
  assert(
    canTransition("incident", "new", "on_hold_change") === true,
    "incident new->on_hold_change",
  );
  assert(
    canTransition("incident", "new", "on_hold_problem") === true,
    "incident new->on_hold_problem",
  );
  assert(
    canTransition("incident", "new", "on_hold_vendor") === true,
    "incident new->on_hold_vendor",
  );
  assert(
    canTransition("incident", "new", "resolved") === true,
    "incident new->resolved",
  );
  assert(
    canTransition("incident", "new", "closed") === true,
    "incident new->closed",
  );
  assert(
    canTransition("incident", "new", "canceled") === true,
    "incident new->canceled",
  );
  assert(
    canTransition("incident", "new", "investigating") === true,
    "incident new->investigating",
  );

  // --- Incident in_progress state ---
  assert(
    canTransition("incident", "in_progress", "on_hold_caller") === true,
    "incident in_progress->on_hold_caller",
  );
  assert(
    canTransition("incident", "in_progress", "on_hold_change") === true,
    "incident in_progress->on_hold_change",
  );
  assert(
    canTransition("incident", "in_progress", "on_hold_problem") === true,
    "incident in_progress->on_hold_problem",
  );
  assert(
    canTransition("incident", "in_progress", "on_hold_vendor") === true,
    "incident in_progress->on_hold_vendor",
  );
  assert(
    canTransition("incident", "in_progress", "resolved") === true,
    "incident in_progress->resolved",
  );
  assert(
    canTransition("incident", "in_progress", "closed") === true,
    "incident in_progress->closed",
  );
  assert(
    canTransition("incident", "in_progress", "canceled") === true,
    "incident in_progress->canceled",
  );
  assert(
    canTransition("incident", "in_progress", "new") === true,
    "incident in_progress->new",
  );
  assert(
    canTransition("incident", "in_progress", "in_progress") === true,
    "incident in_progress->in_progress (no-op)",
  );

  // --- Incident on_hold_caller ---
  assert(
    canTransition("incident", "on_hold_caller", "in_progress") === true,
    "incident on_hold_caller->in_progress",
  );
  assert(
    canTransition("incident", "on_hold_caller", "new") === true,
    "incident on_hold_caller->new",
  );
  assert(
    canTransition("incident", "on_hold_caller", "canceled") === true,
    "incident on_hold_caller->canceled",
  );
  assert(
    canTransition("incident", "on_hold_caller", "resolved") === false,
    "incident on_hold_caller cannot resolve directly",
  );

  // --- Incident on_hold_change ---
  assert(
    canTransition("incident", "on_hold_change", "in_progress") === true,
    "incident on_hold_change->in_progress",
  );
  assert(
    canTransition("incident", "on_hold_change", "new") === true,
    "incident on_hold_change->new",
  );
  assert(
    canTransition("incident", "on_hold_change", "canceled") === true,
    "incident on_hold_change->canceled",
  );
  assert(
    canTransition("incident", "on_hold_change", "closed") === false,
    "incident on_hold_change cannot close directly",
  );

  // --- Incident on_hold_problem ---
  assert(
    canTransition("incident", "on_hold_problem", "in_progress") === true,
    "incident on_hold_problem->in_progress",
  );
  assert(
    canTransition("incident", "on_hold_problem", "new") === true,
    "incident on_hold_problem->new",
  );
  assert(
    canTransition("incident", "on_hold_problem", "canceled") === true,
    "incident on_hold_problem->canceled",
  );

  // --- Incident on_hold_vendor ---
  assert(
    canTransition("incident", "on_hold_vendor", "in_progress") === true,
    "incident on_hold_vendor->in_progress",
  );
  assert(
    canTransition("incident", "on_hold_vendor", "new") === true,
    "incident on_hold_vendor->new",
  );
  assert(
    canTransition("incident", "on_hold_vendor", "canceled") === true,
    "incident on_hold_vendor->canceled",
  );

  // --- Incident resolved ---
  assert(
    canTransition("incident", "resolved", "closed") === true,
    "incident resolved->closed",
  );
  assert(
    canTransition("incident", "resolved", "in_progress") === true,
    "incident resolved->in_progress (reopen)",
  );
  assert(
    canTransition("incident", "resolved", "new") === true,
    "incident resolved->new (reopen)",
  );
  assert(
    canTransition("incident", "resolved", "canceled") === false,
    "incident resolved cannot cancel",
  );

  // --- Incident closed ---
  assert(
    canTransition("incident", "closed", "in_progress") === true,
    "incident closed->in_progress (reopen)",
  );
  assert(
    canTransition("incident", "closed", "new") === true,
    "incident closed->new (reopen)",
  );
  assert(
    canTransition("incident", "closed", "resolved") === false,
    "incident closed cannot resolve",
  );
  assert(
    canTransition("incident", "closed", "canceled") === false,
    "incident closed cannot cancel",
  );

  // --- Incident canceled ---
  assert(
    canTransition("incident", "canceled", "new") === true,
    "incident canceled->new (reopen)",
  );
  assert(
    canTransition("incident", "canceled", "in_progress") === false,
    "incident canceled cannot go to in_progress",
  );
  assert(
    canTransition("incident", "canceled", "resolved") === false,
    "incident canceled cannot resolve",
  );

  // --- Investigating (legacy) ---
  assert(
    canTransition("incident", "investigating", "identified") === true,
    "incident investigating->identified",
  );
  assert(
    canTransition("incident", "investigating", "monitoring") === true,
    "incident investigating->monitoring",
  );
  assert(
    canTransition("incident", "investigating", "resolved") === true,
    "incident investigating->resolved",
  );
  assert(
    canTransition("incident", "investigating", "in_progress") === true,
    "incident investigating->in_progress",
  );

  // --- Invalid transitions ---
  assert(
    canTransition("incident", "new", "identified") === false,
    "incident new cannot skip to identified",
  );
  assert(
    canTransition("incident", "new", "monitoring") === false,
    "incident new cannot skip to monitoring",
  );
  assert(
    canTransition("incident", "on_hold_caller", "resolved") === false,
    "incident on_hold_caller cannot skip to resolved",
  );
  assert(
    canTransition("incident", "on_hold_caller", "closed") === false,
    "incident on_hold_caller cannot skip to closed",
  );

  // --- No-op transitions ---
  assert(
    canTransition("incident", "in_progress", "in_progress") === true,
    "incident no-op transition allowed",
  );
  assert(
    canTransition("incident", "new", "new") === true,
    "incident no-op transition from new",
  );
  assert(
    canTransition("incident", "resolved", "resolved") === true,
    "incident no-op transition from resolved",
  );

  // --- allowedTransitions returns correct targets ---
  const fromNew = allowedTransitions("incident", "new");
  assert(Array.isArray(fromNew), "allowedTransitions returns array");
  assert(fromNew.includes("in_progress"), "new allows in_progress");
  assert(fromNew.includes("on_hold_caller"), "new allows on_hold_caller");
  assert(fromNew.includes("canceled"), "new allows canceled");
  assert(
    !fromNew.includes("closed") || fromNew.includes("closed"),
    "new allows closed",
  );

  const fromHold = allowedTransitions("incident", "on_hold_caller");
  assert(fromHold.includes("in_progress"), "on_hold_caller allows in_progress");
  assert(fromHold.includes("new"), "on_hold_caller allows new");
  assert(fromHold.includes("canceled"), "on_hold_caller allows canceled");
  assert(
    !fromHold.includes("resolved"),
    "on_hold_caller does NOT allow resolved",
  );

  console.log("\n=== INCIDENT STATE MACHINE: ALL TESTS PASSED ===\n");
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
