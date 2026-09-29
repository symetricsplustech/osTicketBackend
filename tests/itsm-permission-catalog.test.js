const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  MODULES,
  allItsmKeys,
  isItsmKey,
} = require("../src/permissions/itsmCatalog");
const { checkPermission } = require("../src/services/authorization.service");

const source = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../SERVICENOW_ITSM_GRANULAR_PERMISSIONS_FINAL.md",
  ),
  "utf8",
);
const documented = new Set();
let active = false;
for (const line of source.split(/\r?\n/)) {
  const heading = line.match(/^# MODULE (\d{2}) (?:—|---)/);
  if (heading) active = Number(heading[1]) >= 1 && Number(heading[1]) <= 18;
  if (!active) continue;
  const match = line.match(/^- {1,3}\[[ xX]\] `(itsm\.[a-z0-9_.]+)`/);
  if (match) documented.add(match[1]);
}

assert.strictEqual(MODULES.length, 20, "catalog must expose every documented module namespace");
// Exact membership is asserted against the Markdown below, so here we only
// guard against a catalog that was regenerated far smaller than before.
assert.ok(
  allItsmKeys().length >= 2916,
  `catalog shrank to ${allItsmKeys().length} keys, expected at least 2916`,
);
assert.deepStrictEqual(
  new Set(allItsmKeys()),
  documented,
  "backend catalog must exactly match the Markdown",
);
assert(
  allItsmKeys().every((key) => isItsmKey(key)),
  "every generated key must be canonical",
);
assert(
  MODULES.every((mod) => allItsmKeys().some((key) => key.startsWith(mod.namespace.replace("*", "")))),
  "every exposed module namespace must own at least one catalog key",
);

const direct = { permissions: ["itsm.incident.incident.read"] };
assert.strictEqual(
  checkPermission(direct, "itsm.incident.incident.read").granted,
  true,
);
assert.strictEqual(
  checkPermission(direct, "itsm.incident.incident.update").granted,
  false,
);
assert.strictEqual(
  checkPermission(
    { permissions: ["itsm.incident.*"] },
    "itsm.incident.incident.update",
  ).granted,
  true,
);
assert.strictEqual(
  checkPermission(
    { permissions: ["itsm.*", "!itsm.incident.*"] },
    "itsm.incident.incident.read",
  ).granted,
  false,
);
assert.strictEqual(
  checkPermission(
    { permissions: ["itsm.*", "!itsm.incident.*"] },
    "itsm.problem.problem.read",
  ).granted,
  true,
);

console.log(
  "PASS ITSM Modules 1-18 permission catalog and wildcard authorization",
);
