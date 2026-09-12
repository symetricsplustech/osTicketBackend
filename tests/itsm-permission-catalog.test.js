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
    "../../SERVICENOW_ITSM_GRANULAR_PERMISSIONS_FROM_TECHNICAL_MASTER.md",
  ),
  "utf8",
);
const documented = new Set();
let active = false;
for (const line of source.split(/\r?\n/)) {
  const heading = line.match(/^# MODULE (\d{2}) —/);
  if (heading) active = Number(heading[1]) >= 1 && Number(heading[1]) <= 10;
  if (!active) continue;
  const match = line.match(/^- \[[ xX]\] `(itsm\.[a-z0-9_.]+)`/);
  if (match) documented.add(match[1]);
}

assert.strictEqual(MODULES.length, 10, "catalog must expose Modules 1-10");
assert.strictEqual(
  allItsmKeys().length,
  1908,
  "catalog must contain all documented keys",
);
assert.deepStrictEqual(
  new Set(allItsmKeys()),
  documented,
  "backend catalog must exactly match the Markdown",
);
assert(allItsmKeys().every(isItsmKey), "every generated key must be canonical");

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
  "PASS ITSM Modules 1-10 permission catalog and wildcard authorization",
);
