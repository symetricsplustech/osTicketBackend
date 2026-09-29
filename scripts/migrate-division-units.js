/* eslint-disable no-console */
// Usage: node scripts/migrate-division-units.js --tenant=<UUID> [--apply]
// Dry-run is the default. Target one exact tenant per invocation.
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const { migrateDivisionToBusinessUnit } = require("../src/services/organizationTypeMigration.service");

const tenantArg = process.argv.find((arg) => arg.startsWith("--tenant="));
const tenantId = tenantArg?.slice("--tenant=".length);
const apply = process.argv.includes("--apply");

async function run() {
  if (!tenantId) throw new Error("Pass --tenant=<UUID> to target one tenant");
  await connectDB();
  try {
    const result = await migrateDivisionToBusinessUnit(tenantId, { apply });
    console.log(JSON.stringify(result));
  } finally {
    await getDB().destroy();
  }
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; });
