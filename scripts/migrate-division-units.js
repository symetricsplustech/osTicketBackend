/* eslint-disable no-console */
// Usage: node scripts/migrate-division-units.js --tenant=<ObjectId> [--apply]
// Dry-run is the default. Target one exact tenant per invocation.
const mongoose = require("mongoose");
const config = require("../src/config/config");
const { migrateDivisionToBusinessUnit } = require("../src/services/organizationTypeMigration.service");

const tenantArg = process.argv.find((arg) => arg.startsWith("--tenant="));
const tenantId = tenantArg?.slice("--tenant=".length);
const apply = process.argv.includes("--apply");

async function run() {
  if (!tenantId) throw new Error("Pass --tenant=<ObjectId> to target one tenant");
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  try {
    const result = await migrateDivisionToBusinessUnit(tenantId, { apply });
    console.log(JSON.stringify(result));
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; });
