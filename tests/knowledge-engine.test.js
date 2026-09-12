/* eslint-disable no-console */
// Knowledge Management state machine tests
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  canTransition,
  allowedTransitions,
  FAQ_TRANSITIONS,
} = require("../src/services/stateMachine.service");

(async () => {
  console.log("\n=== KNOWLEDGE MANAGEMENT STATE MACHINE TESTS ===\n");

  // --- draft ---
  assert(canTransition("faq", "draft", "review") === true, "KB draft->review");
  assert(
    canTransition("faq", "draft", "archived") === true,
    "KB draft->archived",
  );
  assert(
    canTransition("faq", "draft", "published") === false,
    "KB draft cannot skip to published",
  );
  assert(
    canTransition("faq", "draft", "approved") === false,
    "KB draft cannot skip to approved",
  );
  assert(
    canTransition("faq", "draft", "expired") === false,
    "KB draft cannot skip to expired",
  );

  // --- review ---
  assert(
    canTransition("faq", "review", "approved") === true,
    "KB review->approved",
  );
  assert(
    canTransition("faq", "review", "draft") === true,
    "KB review->draft (reject)",
  );
  assert(
    canTransition("faq", "review", "published") === false,
    "KB review cannot skip to published",
  );
  assert(
    canTransition("faq", "review", "archived") === false,
    "KB review cannot skip to archived",
  );

  // --- approved ---
  assert(
    canTransition("faq", "approved", "published") === true,
    "KB approved->published",
  );
  assert(
    canTransition("faq", "approved", "review") === true,
    "KB approved->review (rework)",
  );
  assert(
    canTransition("faq", "approved", "draft") === false,
    "KB approved cannot go to draft",
  );

  // --- published ---
  assert(
    canTransition("faq", "published", "expired") === true,
    "KB published->expired",
  );
  assert(
    canTransition("faq", "published", "archived") === true,
    "KB published->archived",
  );
  assert(
    canTransition("faq", "published", "review") === true,
    "KB published->review (update)",
  );
  assert(
    canTransition("faq", "published", "draft") === true,
    "KB published->draft",
  );
  assert(
    canTransition("faq", "published", "approved") === false,
    "KB published cannot go to approved",
  );

  // --- expired ---
  assert(
    canTransition("faq", "expired", "review") === true,
    "KB expired->review (renew)",
  );
  assert(
    canTransition("faq", "expired", "archived") === true,
    "KB expired->archived",
  );
  assert(
    canTransition("faq", "expired", "published") === false,
    "KB expired cannot skip to published",
  );

  // --- archived ---
  assert(
    canTransition("faq", "archived", "draft") === true,
    "KB archived->draft (restore)",
  );
  assert(
    canTransition("faq", "archived", "review") === false,
    "KB archived cannot go to review",
  );
  assert(
    canTransition("faq", "archived", "published") === false,
    "KB archived cannot skip to published",
  );

  // --- No-op ---
  assert(
    canTransition("faq", "draft", "draft") === true,
    "KB no-op from draft",
  );
  assert(
    canTransition("faq", "published", "published") === true,
    "KB no-op from published",
  );

  // --- allowedTransitions ---
  const fromDraft = allowedTransitions("faq", "draft");
  assert(fromDraft.includes("review"), "draft allows review");
  assert(fromDraft.includes("archived"), "draft allows archived");
  assert(!fromDraft.includes("published"), "draft does NOT allow published");

  const fromPublished = allowedTransitions("faq", "published");
  assert(fromPublished.includes("expired"), "published allows expired");
  assert(fromPublished.includes("archived"), "published allows archived");
  assert(fromPublished.includes("review"), "published allows review");
  assert(fromPublished.includes("draft"), "published allows draft");

  // --- Invalid transition error ---
  let threw = false;
  try {
    canTransition("faq", "draft", "published");
  } catch {
    threw = true;
  }
  // canTransition does NOT throw, it returns false
  assert(
    canTransition("faq", "draft", "published") === false,
    "canTransition returns false for invalid",
  );

  console.log(
    "\n=== KNOWLEDGE MANAGEMENT STATE MACHINE: ALL TESTS PASSED ===\n",
  );
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
