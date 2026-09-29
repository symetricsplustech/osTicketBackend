/* eslint-disable no-console */
// DB-free tests for authorization.service scope evaluators + field policies.
// Run: node tests/authorization-service.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  evaluateScope,
  evaluateFieldPolicy,
  maskFields,
  FIELD_DIMENSIONS,
} = require("../src/services/authorization.service");

const principal = (overrides = {}) => ({
  _id: "agent-1",
  organization: "org-1",
  businessUnit: "bu-1",
  branch: "br-1",
  location: "loc-1",
  groups: ["grp-1"],
  teams: ["team-1"],
  assignmentGroups: ["asg-1"],
  departments: [{ department: "dept-1" }],
  ...overrides,
});

(async () => {
  console.log("\n=== SCOPE EVALUATION TESTS ===\n");

  assert(
    evaluateScope(principal(), "TENANT", { company: "tenant-a" }, "tenant-a") === true,
    "TENANT matches company === tenant",
  );
  assert(
    evaluateScope(principal(), "ORGANIZATION", { organization: "org-1" }, "tenant-a") === true,
    "ORGANIZATION matches principal organization",
  );
  assert(
    evaluateScope(principal(), "BUSINESS_UNIT", { unit: "bu-1" }, "tenant-a") === true,
    "BUSINESS_UNIT matches principal business unit",
  );
  assert(
    evaluateScope(principal(), "BRANCH", { branch: "br-1" }, "tenant-a") === true,
    "BRANCH matches principal branch",
  );
  assert(
    evaluateScope(principal(), "LOCATION", { locationId: "loc-1" }, "tenant-a") === true,
    "LOCATION matches principal location",
  );
  assert(
    evaluateScope(principal(), "GROUP", { groups: ["grp-1", "grp-2"] }, "tenant-a") === true,
    "GROUP matches principal group",
  );
  assert(
    evaluateScope(principal(), "ASSIGNMENT_GROUP", { assignmentGroup: "team-1" }, "tenant-a") === true,
    "ASSIGNMENT_GROUP matches principal team/assignment group",
  );
  assert(
    evaluateScope(principal(), "REQUESTED_FOR_ME", { requestedFor: "agent-1" }, "tenant-a") === true,
    "REQUESTED_FOR_ME matches requestedFor",
  );
  assert(
    evaluateScope(principal(), "CREATED_BY_ME", { openedBy: "agent-1" }, "tenant-a") === true,
    "CREATED_BY_ME matches openedBy",
  );
  assert(
    evaluateScope(principal(), "WATCHING", { watchers: ["other", "agent-1"] }, "tenant-a") === true,
    "WATCHING matches watchers",
  );
  assert(
    evaluateScope(
      principal(),
      "MANAGED_USERS",
      { requester: "user-99" },
      "tenant-a",
      { managedUserIds: ["user-99"] },
    ) === true,
    "MANAGED_USERS matches managed-user list",
  );
  assert(
    evaluateScope(
      principal(),
      "CUSTOM",
      { severity: "critical" },
      "tenant-a",
      { customScope: (r) => r.severity === "critical" },
    ) === true,
    "CUSTOM evaluates context predicate",
  );
  assert(
    evaluateScope(principal(), "ORGANIZATION", { organization: "org-OTHER" }, "tenant-a") === false,
    "ORGANIZATION rejects foreign org",
  );
  assert(
    evaluateScope(principal(), "MANAGED_USERS", { requester: "u1" }, "tenant-a") === false,
    "MANAGED_USERS false without graph",
  );

  console.log("\n=== FIELD POLICY TESTS ===\n");

  assert(
    FIELD_DIMENSIONS.length === 10 &&
      FIELD_DIMENSIONS.includes("API_WRITE") &&
      FIELD_DIMENSIONS.includes("EXPORT"),
    "10 field-policy dimensions defined",
  );

  const noGrants = principal();
  // Non-sensitive field is always allowed
  assert(
    evaluateFieldPolicy(noGrants, "incident", "short_description", "READ") === true,
    "non-sensitive field always readable",
  );
  // Sensitive field denied without grant
  assert(
    evaluateFieldPolicy(noGrants, "incident", "work_notes", "READ") === false,
    "sensitive field denied without grant",
  );

  // Role fieldAccess with per-dimension grant
  const dimPrincipal = principal({
    role: { fieldAccess: ["field:work_notes:WRITE"] },
  });
  assert(
    evaluateFieldPolicy(dimPrincipal, "incident", "work_notes", "WRITE") === true,
    "dimension grant allows WRITE",
  );
  assert(
    evaluateFieldPolicy(dimPrincipal, "incident", "work_notes", "READ") === false,
    "dimension grant does not imply READ",
  );

  // Legacy bare field grant implies full access
  const fullPrincipal = principal({
    role: { fieldAccess: ["work_notes"] },
  });
  assert(
    evaluateFieldPolicy(fullPrincipal, "incident", "work_notes", "READ") === true &&
      evaluateFieldPolicy(fullPrincipal, "incident", "work_notes", "EXPORT") === true,
    "bare field grant implies all dimensions",
  );

  // maskFields partition
  const part = maskFields(
    fullPrincipal,
    "incident",
    ["short_description", "work_notes"],
  );
  assert(
    part.visible.includes("short_description") && part.visible.includes("work_notes"),
    "granted fields visible",
  );

  const part2 = maskFields(
    dimPrincipal,
    "incident",
    ["work_notes", "resolution"],
  );
  assert(part2.masked.includes("work_notes") === false, "WRITE-only not readable -> hidden");
  assert(
    part2.hidden.includes("work_notes") || part2.masked.includes("work_notes"),
    "unauthorized sensitive field never visible",
  );

  const softMask = principal({
    role: { fieldAccess: ["field:work_notes:READ"] },
  });
  const part3 = maskFields(softMask, "incident", ["work_notes"]);
  assert(
    part3.masked.includes("work_notes") && !part3.visible.includes("work_notes"),
    "READ-without-UNMASK is masked",
  );
})().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});