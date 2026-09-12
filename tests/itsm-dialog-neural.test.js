/* eslint-disable no-console */
// Dialog runner + neural scoring pure logic — DB-free unit tests
// (MD §82 dialog designer / neural search). Run: node tests/itsm-dialog-neural.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  tokenize,
  cosineScore,
  termFreq,
} = require("../src/services/suggestion.service");

// --- neural scoring primitives ---
const q = termFreq(tokenize("my laptop is slow and broken"));
const d = termFreq(tokenize("laptop slow performance issue resolved"));
const docFreq = new Map([
  ["laptop", 2],
  ["slow", 2],
  ["broken", 1],
  ["performance", 1],
  ["issue", 1],
  ["resolved", 1],
  ["my", 1],
  ["and", 1],
  ["is", 1],
]);
const score = cosineScore(q, d, docFreq, 3);
assert(
  Number.isFinite(score) && score > 0 && score <= 1,
  `cosineScore bounded (0 < ${score.toFixed(3)} <= 1)`,
);

const q2 = termFreq(tokenize("xyzzy plugh"));
const score2 = cosineScore(q2, d, docFreq, 3);
assert(score2 === 0, "unrelated query scores 0");

// --- virtual agent intent ranking ---
const { rankIntent } = require("../src/services/virtualAgent.service");
(async () => {
  const cases = [
    ["can you check my ticket status", "status"],
    ["hello there", "greeting"],
    ["how do I fix my printer", "troubleshoot"],
    ["i want a new monitor please", "catalog"],
    ["please escalate now", "escalate"],
    ["totally meaningless blurb", "fallback"],
  ];
  for (const [text, expected] of cases) {
    const r = await rankIntent(null, text);
    assert(
      r.intent === expected,
      `rankIntent('${text}')=${r.intent} expected ${expected}`,
    );
  }
  console.log("\nAll dialog/neural unit tests passed.");
})();
