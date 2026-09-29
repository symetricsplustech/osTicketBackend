/**
 * Phase 15/16 service-vs-schema drift check.
 *
 * The improvement and outage services write columns the tables were never
 * migrated with, which only shows up at runtime as one error at a time:
 *
 *   update "improvement_initiatives" set ... - column "actual_start_date" does not exist
 *
 * This script finds them in a single pass so the gap is visible before it is
 * hit in production. For each service it collects the columns written from:
 *
 *   Model.create({...}) payloads      `pick(...)` / `allowed = [...]` lists
 *   record.field = ... assignments    Object.assign(record, {...})
 *
 * and diffs them against information_schema, read in one round trip.
 *
 * Scope and limits:
 *   - Columns a service forwards from the request body through a `...data`
 *     spread cannot be enumerated statically, so this is a floor, not a
 *     ceiling. scripts/smoke-improvement-outage.js covers those at runtime.
 *   - Reads are not checked here: detecting them statically needs real
 *     expression parsing to tell a filter key from a value (`{ _id: goalId }`),
 *     and the runtime smoke test already exercises the reads.
 *
 * Run: node scripts/check-service-schema-drift.js
 * Exits non-zero while any drift remains.
 */

const fs = require("fs");
const path = require("path");
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");

const SERVICES = ["improvementService", "outageService"];

const MODEL_TABLES = {
  ImprovementOpportunity: "improvement_opportunities",
  ImprovementInitiative: "improvement_initiatives",
  ImprovementTask: "improvement_tasks",
  ImprovementGoal: "improvement_goals",
  Benefit: "benefits",
  Cost: "costs",
  MetricBaseline: "metric_baselines",
  MetricTarget: "metric_targets",
  Outage: "outages",
  OutageCI: "outage_cis",
  OutageService: "outage_services",
  AvailabilityRecord: "availability_records",
};

/** Locals and helpers that are never columns. */
const IGNORED = new Set([
  "data",
  "id",
  "_id",
  "user_id",
  "userid",
  "author_id",
  "message",
  "length",
]);

const snake = (value) => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const candidatesFor = (source) => {
  const fields = {};
  for (const block of source.split(/\nexports\./).slice(1)) {
    // Anchor on the model the function owns. A `Model.create(...)` payload is
    // authoritative; otherwise fall back to the record loaded with findOne.
    // Scanning for any model reference would mis-attribute helpers such as
    // calculateAvailability, which reads Outage but creates AvailabilityRecord.
    const created = block.match(/return ([A-Z][A-Za-z]*)\.create\(/);
    const loaded = block.match(
      /const [a-z][A-Za-z0-9_]* = await ([A-Z][A-Za-z]*)\.findOne\(/,
    );
    const anchor = created || loaded;
    const table = anchor ? MODEL_TABLES[anchor[1]] : null;
    if (!table) continue;

    fields[table] = fields[table] || new Set();
    const keep = (name) => {
      const column = snake(name);
      if (column && !IGNORED.has(column)) fields[table].add(column);
    };

    for (const literal of block.matchAll(/\.create\(\s*\{([\s\S]*?)\}\s*\)/g)) {
      for (const key of literal[1].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*[:,}]/g)) {
        keep(key[1]);
      }
    }
    for (const list of block.matchAll(
      /(?:const allowed = |pick\(\s*\w+\s*,\s*)\[([\s\S]*?)\]/g,
    )) {
      for (const key of list[1].matchAll(/["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]/g)) {
        keep(key[1]);
      }
    }
    const locals = new Set(
      [
        ...block.matchAll(
          /(?:const|let)\s+([a-z][A-Za-z0-9_]*)\s*=\s*await\s+[A-Z][A-Za-z0-9_]*\./g,
        ),
      ].map((match) => match[1]),
    );
    for (const assign of block.matchAll(
      /\b([a-z][A-Za-z0-9_]*)\.([a-z][A-Za-z0-9_]*)\s*=[^=]/g,
    )) {
      if (locals.has(assign[1])) keep(assign[2]);
    }
    for (const assign of block.matchAll(
      /Object\.assign\(\s*[a-z][A-Za-z0-9_]*\s*,\s*\{([\s\S]*?)\}\s*\)/g,
    )) {
      for (const key of assign[1].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*[:,}]/g)) {
        keep(key[1]);
      }
    }
  }
  return fields;
};

(async () => {
  await connectDB();
  const db = getDB();
  const candidates = {};
  for (const service of SERVICES) {
    const file = path.resolve(__dirname, `../src/services/${service}.js`);
    const fields = candidatesFor(fs.readFileSync(file, "utf8"));
    for (const [table, columns] of Object.entries(fields)) {
      candidates[table] = candidates[table] || new Set();
      columns.forEach((column) => candidates[table].add(column));
    }
  }

  // One round trip for the whole schema, then a set difference. A transaction
  // is deliberately not used: the first failing statement would abort it and
  // make every later probe report a bogus error.
  const { rows } = await db.raw(
    "select table_name, column_name from information_schema.columns where table_schema = ?",
    ["public"],
  );
  const existing = {};
  for (const row of rows) {
    existing[row.table_name] = existing[row.table_name] || new Set();
    existing[row.table_name].add(row.column_name);
  }

  const drift = {};
  for (const [table, columns] of Object.entries(candidates)) {
    if (!existing[table]) {
      drift[table] = ["<table does not exist>"];
      continue;
    }
    const missing = [...columns].filter((column) => !existing[table].has(column));
    if (missing.length) drift[table] = missing.sort();
  }

  const total = Object.values(drift).reduce((sum, list) => sum + list.length, 0);
  if (!total) {
    console.log(
      `PASS no schema drift across ${Object.keys(candidates).length} improvement/outage tables`,
    );
    return;
  }
  for (const [table, columns] of Object.entries(drift)) {
    console.log(`${table}: ${columns.join(", ")}`);
  }
  console.log(`\nFAIL ${total} columns written by the services do not exist`);
  process.exitCode = 1;
})().catch((error) => {
  console.error("check failed:", error.message);
  process.exitCode = 1;
});
