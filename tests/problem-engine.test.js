/* eslint-disable no-console */
// Problem Management tests: state machine, transitions, business rules
// DB-free unit tests. Run: node tests/problem-engine.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  canTransition,
  allowedTransitions,
  PROBLEM_TRANSITIONS,
} = require("../src/services/stateMachine.service");

(async () => {
  console.log("\n=== PROBLEM STATE MACHINE TESTS ===\n");

  // --- Problem new state ---
  assert(
    canTransition("problem", "new", "assess") === true,
    "problem new->assess",
  );
  assert(
    canTransition("problem", "new", "canceled") === true,
    "problem new->canceled",
  );
  assert(
    canTransition("problem", "new", "root_cause_analysis") === false,
    "problem new cannot skip to root_cause_analysis",
  );
  assert(
    canTransition("problem", "new", "fix_in_progress") === false,
    "problem new cannot skip to fix_in_progress",
  );
  assert(
    canTransition("problem", "new", "resolved") === false,
    "problem new cannot skip to resolved",
  );
  assert(
    canTransition("problem", "new", "closed") === false,
    "problem new cannot skip to closed",
  );

  // --- Problem assess state ---
  assert(
    canTransition("problem", "assess", "root_cause_analysis") === true,
    "problem assess->root_cause_analysis",
  );
  assert(
    canTransition("problem", "assess", "fix_in_progress") === true,
    "problem assess->fix_in_progress",
  );
  assert(
    canTransition("problem", "assess", "resolved") === true,
    "problem assess->resolved",
  );
  assert(
    canTransition("problem", "assess", "canceled") === true,
    "problem assess->canceled",
  );
  assert(
    canTransition("problem", "assess", "risk_accepted") === true,
    "problem assess->risk_accepted",
  );
  assert(
    canTransition("problem", "assess", "new") === false,
    "problem assess cannot go to new",
  );
  assert(
    canTransition("problem", "assess", "closed") === false,
    "problem assess cannot skip to closed",
  );

  // --- Problem root_cause_analysis state ---
  assert(
    canTransition("problem", "root_cause_analysis", "fix_in_progress") === true,
    "problem rca->fix_in_progress",
  );
  assert(
    canTransition("problem", "root_cause_analysis", "assess") === true,
    "problem rca->assess",
  );
  assert(
    canTransition("problem", "root_cause_analysis", "canceled") === true,
    "problem rca->canceled",
  );
  assert(
    canTransition("problem", "root_cause_analysis", "risk_accepted") === true,
    "problem rca->risk_accepted",
  );
  assert(
    canTransition("problem", "root_cause_analysis", "resolved") === false,
    "problem rca cannot resolve directly",
  );
  assert(
    canTransition("problem", "root_cause_analysis", "closed") === false,
    "problem rca cannot close directly",
  );

  // --- Problem fix_in_progress state ---
  assert(
    canTransition("problem", "fix_in_progress", "resolved") === true,
    "problem fix_in_progress->resolved",
  );
  assert(
    canTransition("problem", "fix_in_progress", "root_cause_analysis") === true,
    "problem fix_in_progress->root_cause_analysis",
  );
  assert(
    canTransition("problem", "fix_in_progress", "assess") === true,
    "problem fix_in_progress->assess",
  );
  assert(
    canTransition("problem", "fix_in_progress", "canceled") === true,
    "problem fix_in_progress->canceled",
  );
  assert(
    canTransition("problem", "fix_in_progress", "closed") === false,
    "problem fix_in_progress cannot close directly",
  );

  // --- Problem resolved state ---
  assert(
    canTransition("problem", "resolved", "closed") === true,
    "problem resolved->closed",
  );
  assert(
    canTransition("problem", "resolved", "fix_in_progress") === true,
    "problem resolved->fix_in_progress (reopen)",
  );
  assert(
    canTransition("problem", "resolved", "assess") === true,
    "problem resolved->assess (reopen)",
  );
  assert(
    canTransition("problem", "resolved", "canceled") === false,
    "problem resolved cannot cancel",
  );

  // --- Problem closed state ---
  assert(
    canTransition("problem", "closed", "assess") === true,
    "problem closed->assess (reopen)",
  );
  assert(
    canTransition("problem", "closed", "new") === false,
    "problem closed cannot go to new",
  );
  assert(
    canTransition("problem", "closed", "resolved") === false,
    "problem closed cannot resolve",
  );

  // --- Problem canceled state ---
  assert(
    canTransition("problem", "canceled", "new") === true,
    "problem canceled->new (reopen)",
  );
  assert(
    canTransition("problem", "canceled", "assess") === false,
    "problem canceled cannot go to assess",
  );
  assert(
    canTransition("problem", "canceled", "resolved") === false,
    "problem canceled cannot resolve",
  );

  // --- Problem risk_accepted state ---
  assert(
    canTransition("problem", "risk_accepted", "assess") === true,
    "problem risk_accepted->assess",
  );
  assert(
    canTransition("problem", "risk_accepted", "canceled") === true,
    "problem risk_accepted->canceled",
  );
  assert(
    canTransition("problem", "risk_accepted", "resolved") === false,
    "problem risk_accepted cannot resolve",
  );
  assert(
    canTransition("problem", "risk_accepted", "closed") === false,
    "problem risk_accepted cannot close",
  );

  // --- No-op transitions ---
  assert(
    canTransition("problem", "new", "new") === true,
    "problem no-op from new",
  );
  assert(
    canTransition("problem", "assess", "assess") === true,
    "problem no-op from assess",
  );
  assert(
    canTransition("problem", "resolved", "resolved") === true,
    "problem no-op from resolved",
  );

  // --- allowedTransitions ---
  const fromNew = allowedTransitions("problem", "new");
  assert(Array.isArray(fromNew), "allowedTransitions returns array");
  assert(fromNew.includes("assess"), "new allows assess");
  assert(fromNew.includes("canceled"), "new allows canceled");
  assert(!fromNew.includes("resolved"), "new does NOT allow resolved");

  const fromAssess = allowedTransitions("problem", "assess");
  assert(
    fromAssess.includes("root_cause_analysis"),
    "assess allows root_cause_analysis",
  );
  assert(fromAssess.includes("risk_accepted"), "assess allows risk_accepted");
  assert(!fromAssess.includes("closed"), "assess does NOT allow closed");

  const fromRca = allowedTransitions("problem", "root_cause_analysis");
  assert(fromRca.includes("fix_in_progress"), "rca allows fix_in_progress");
  assert(fromRca.includes("assess"), "rca allows assess");
  assert(!fromRca.includes("resolved"), "rca does NOT allow resolved");

  // --- Legacy states removed (replaced by new state machine) ---
  // open, investigation, known_error, workaround, root_cause, fixed are no longer valid statuses
  assert(
    canTransition("problem", "open", "investigation") === false,
    "legacy open->investigation no longer valid",
  );
  assert(
    canTransition("problem", "new", "investigation") === false,
    "new cannot go to legacy investigation",
  );

  console.log("\n=== PROBLEM STATE MACHINE: ALL TESTS PASSED ===\n");
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
