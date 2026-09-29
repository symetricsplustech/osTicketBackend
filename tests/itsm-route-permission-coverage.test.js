const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { allItsmKeys } = require("../src/permissions/itsmCatalog");
const {
  TENANT_CORE_PERMISSIONS,
} = require("../src/permissions/tenantCorePermissions");
const {
  DOMAIN_PERMISSIONS,
} = require("../src/permissions/instanceDomainDefaults");

const routesDir = path.resolve(__dirname, "../src/routes");

const collect = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });

const used = new Map();
for (const file of collect(routesDir)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /requirePermission\(\s*["'`]([^"'`]+)["'`]/g,
  )) {
    const key = match[1];
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(path.relative(path.resolve(__dirname, ".."), file));
  }
}

const known = new Set([
  ...allItsmKeys(),
  ...TENANT_CORE_PERMISSIONS,
  ...Object.values(DOMAIN_PERMISSIONS).flat(),
]);

const unresolved = [...used.keys()].filter((key) => !known.has(key)).sort();

assert(
  used.size > 300,
  `expected a populated route permission surface, found ${used.size}`,
);
assert.deepStrictEqual(
  unresolved,
  [],
  `route permissions missing from every permission catalog:\n${unresolved
    .map((key) => `  ${key}  (${used.get(key).join(", ")})`)
    .join("\n")}`,
);

console.log(
  `PASS ${used.size} route permission keys resolve to a permission catalog`,
);
