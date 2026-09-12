const fs = require("fs");
const path = require("path");

const source = path.resolve(
  __dirname,
  "../../SERVICENOW_ITSM_GRANULAR_PERMISSIONS_FROM_TECHNICAL_MASTER.md",
);
const target = path.resolve(__dirname, "../src/permissions/itsmCatalogData.js");
const markdown = fs.readFileSync(source, "utf8");
const modules = {};
let current = null;

for (const line of markdown.split(/\r?\n/)) {
  const heading = line.match(/^# MODULE (\d{2}) —/);
  if (heading) {
    const number = Number(heading[1]);
    current = number >= 1 && number <= 12 ? number : null;
    continue;
  }
  if (!current) continue;
  const match = line.match(/^- \[[ xX]\] `(itsm\.([a-z0-9_]+)\.[a-z0-9_.]+)`/);
  if (!match) continue;
  modules[match[2]] = modules[match[2]] || new Set();
  modules[match[2]].add(match[1]);
}

const data = Object.fromEntries(
  Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => [key, [...values].sort()]),
);
const total = Object.values(data).reduce(
  (sum, values) => sum + values.length,
  0,
);
const output = `// GENERATED from SERVICENOW_ITSM_GRANULAR_PERMISSIONS_FROM_TECHNICAL_MASTER.md\n// Modules 1-10. Do not hand-edit; regenerate with scripts/generate-itsm-catalog.js\n\nmodule.exports = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(target, output);
console.log(
  `Generated ${total} permissions across ${Object.keys(data).length} modules.`,
);
