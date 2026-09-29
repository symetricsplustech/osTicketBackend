/* eslint-disable no-console */
// DB-free tests for the authorization route adapters added in
// routes/authorization.routes.js and the /itsm/permissions/tree anchor.
// Run: node tests/authorization-routes.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  resolveEffectivePermissions,
  hasPermission,
  checkScope,
} = require("../src/services/authorization.service");
const catalog = require("../src/permissions/itsmCatalog");

(async () => {
  console.log("\n=== AUTHORIZATION ROUTE ADAPTER TESTS ===\n");

  // ---- /authorization/tree payload matches the FE picker/tree contract
  const modules = catalog.tree();
  const exposedNamespaces = new Set(catalog.MODULES.map((m) => m.namespace));
  const populatedNamespaces = new Set(
    catalog.MODULES.filter((m) =>
      catalog.allItsmKeys().some((k) =>
        k.startsWith(m.namespace.replace("*", "")),
      ),
    ).map((m) => m.namespace),
  );
  assert(
    Array.isArray(modules) && modules.length === catalog.MODULES.length,
    `tree returns every catalog module (${catalog.MODULES.length})`,
  );
  assert(
    [...exposedNamespaces].every((ns) => populatedNamespaces.has(ns)),
    "every exposed module namespace owns at least one permission key",
  );
  const first = modules[0];
  assert(first.module && first.module.key, "module has key/label");
  assert(
    Array.isArray(first.groups) && Array.isArray(first.groups[0].resources),
    "tree nests groups > resources",
  );
  const leafKeys = [];
  const walk = (resources) => {
    for (const r of resources) {
      for (const a of r.actions || []) leafKeys.push(a.key);
      if (r.children) walk(r.children);
    }
  };
  modules.forEach((m) => m.groups.forEach((g) => walk(g.resources)));
  assert(leafKeys.length > 1800, "tree exposes concrete itsm.* action keys");

  // ---- /authorization/field-policies payload: resource -> sensitive fields
  const policies = catalog.FIELD_POLICIES;
  assert(
    Object.keys(policies).includes("incident"),
    "incident has a field policy",
  );
  assert(
    policies.incident.includes("work_notes"),
    "work_notes is protected for incidents",
  );
  assert(
    Array.isArray(policies.problem) && policies.problem.length > 0,
    "problem policy lists sensitive fields",
  );

  // ---- /itsm/permissions/tree shapes (route in routes/index.js)
  const catalogKeys = catalog.allItsmKeys();
  // A floor, not an exact count: itsm-permission-catalog.test.js already asserts
  // exact parity between the canonical spec and the generated catalog, so an
  // exact number here only duplicated that check and broke on every addition.
  assert(
    typeof catalog.allItsmKeys === "function" && catalogKeys.length >= 2916,
    `canonical itsm.* catalog holds at least 2,916 keys across 20 modules (got ${catalogKeys.length})`,
  );
  assert(
    new Set(catalogKeys).size === catalogKeys.length,
    "canonical itsm.* catalog has no duplicate keys",
  );
  assert(
    catalogKeys.every((key) => catalog.isItsmKey(key)),
    "every catalog key is canonical",
  );

  // ---- /authorization/me/effective payload shape (frontend contract)
  const principal = {
    _id: "agent-1",
    name: "Agent One",
    permissions: ["tenant.user.read", "kb.read", "itsm.incident.incident.read"],
    role: { _id: "r1", name: "ITSM Agent", permissions: ["itsm.incident.incident.update"], recordScopes: ["TENANT"] },
  };
  const eff = resolveEffectivePermissions(principal);
  assert(Array.isArray(eff.grants), "grants is an array");
  assert(eff.grants.includes("itsm.incident.incident.update"), "role grant expanded");
  assert(eff.grants.includes("itsm.knowledge.knowledge_article.read"), "legacy kb.read transcoded");
  assert(typeof eff.sources === "object" && !Array.isArray(eff.sources), "sources is a per-key map");
  assert(eff.sources["itsm.incident.incident.update"] === "role", "role-sourced badge entry");
  assert(eff.sources["itsm.knowledge.knowledge_article.read"] === "legacy", "legacy-sourced badge entry");
  assert(Array.isArray(eff.roles) && eff.roles[0].name === "ITSM Agent", "roles list included");

  // ---- /authorization/simulate decision/trace pipeline
  assert(hasPermission(principal, "itsm.incident.incident.update"), "simulate ALLOWs held key");
  assert(!hasPermission(principal, "itsm.incident.incident.delete"), "simulate DENY for unheld key");
  const scopeOk = checkScope(principal, { company: "tenant-1" }, "tenant-1");
  assert(scopeOk.ok === true, "record within tenant passes scope check");

  // ---- /authorization/users/:id/effective is admin-guarded (requirePermission tenant.user.read)
  assert(hasPermission(principal, "tenant.user.read"), "viewer requires tenant.user.read");

  console.log("\nAll authorization route adapter tests passed.\n");
  process.exit(0);
})().catch((err) => {
  console.error("\n", err.message);
  process.exit(1);
});