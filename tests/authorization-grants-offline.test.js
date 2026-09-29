/* eslint-disable no-console */
// Offline unit tests for the temporary-grant layer — pure functions only
// (mergeGrants, isValidPermissionKey). No DB access, no network.
// Run: node tests/authorization-grants-offline.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  mergeGrants,
  isValidPermissionKey,
} = require("../src/services/authorizationGrants.service");

const base = {
  grants: ["itsm.incident.incident.read", "itsm.incident.incident.create"],
  direct: ["itsm.incident.incident.read"],
  effective: ["itsm.incident.incident.read", "itsm.incident.incident.create"],
  denied: [],
  legacy: [],
  aliases: [],
  scopes: {},
  sources: {
    "itsm.incident.incident.read": "direct",
    "itsm.incident.incident.create": "role",
  },
  roles: [],
};

// ── isValidPermissionKey ─────────────────────────────────────────────────
assert(isValidPermissionKey("itsm.incident.incident.delete") === true, "known itsm key accepted");
assert(isValidPermissionKey("tenant.permission.manage") === true, "tenant root accepted");
assert(isValidPermissionKey("instance.email.channel.read") === true, "instance root accepted");
assert(isValidPermissionKey("access.manage") === true, "access root accepted");
assert(isValidPermissionKey("") === false, "empty key rejected");
assert(isValidPermissionKey("  ") === false, "whitespace key rejected");
assert(isValidPermissionKey("totally bogus*") === false, "unknown root rejected");
assert(isValidPermissionKey("itsm.incident delete") === false, "whitespace inside key rejected");

// ── mergeGrants: layered + sources === 'temporary' ───────────────────────
const grants = [
  {
    _id: "g-1",
    permission: "itsm.incident.incident.delete",
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    grantedBy: "agent-9",
  },
];
const merged = mergeGrants(base, grants);
assert(merged.grants.includes("itsm.incident.incident.delete"), "temp key appended to grants");
assert(merged.effective.includes("itsm.incident.incident.delete"), "temp key appended to effective");
assert(merged.sources["itsm.incident.incident.delete"] === "temporary", "source badge is temporary");
assert(merged.sources["itsm.incident.incident.read"] === "direct", "existing source untouched");
assert(merged.sources["itsm.incident.incident.create"] === "role", "existing role source untouched");
assert(merged.temporaryGrants.length === 1, "temporaryGrants metadata emitted");
assert(merged.temporaryGrants[0].grantId === "g-1", "grantId propagated");
assert(merged.temporaryGrants[0].expiresAt === "2099-01-01T00:00:00.000Z", "expiry serialized to ISO");

// ── mergeGrants: grants never downgrade an existing source ───────────────
const noop = mergeGrants(base, [
  { _id: "g-2", permission: "itsm.incident.incident.read", expiresAt: null, grantedBy: null },
]);
assert(noop.sources["itsm.incident.incident.read"] === "direct", "temporary grant cannot downgrade direct");
assert(noop.temporaryGrants.length === 1, "metadata still recorded even when key already held");

// ── mergeGrants: '*' filtered out of effective surface ────────────────────
const star = mergeGrants(base, [
  { _id: "g-3", permission: "*", expiresAt: null, grantedBy: null },
]);
assert(!star.grants.includes("*"), "wildcard grant never surfaced as a key");
assert(star.temporaryGrants[0].grantId === "g-3", "metadata still recorded for wildcard grant");

console.log("\n✔ AUTHORIZATION GRANTS OFFLINE TESTS DONE\n");