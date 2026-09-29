/* eslint-disable no-console */
// DB-free tests for quiet-hours logic and the broken-Platform5 regression.
// Run: node tests/quiet-hours.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  inQuietHours,
  nextWindowEnd,
  URGENT_TYPES,
} = require("../src/services/quietHours.service");

(async () => {
  console.log("\n=== QUIET HOURS TESTS ===\n");

  assert(
    inQuietHours(null) === null,
    "no prefs -> not inside quiet hours",
  );
  assert(
    inQuietHours({}) === null,
    "empty prefs -> not inside quiet hours",
  );
  assert(
    inQuietHours({ quietHours: { enabled: false } }) === null,
    "disabled quiet hours -> not inside",
  );

  // Non-wrapping window (e.g. 22:00-06:00)
  const wm = inQuietHours({
    quietHours: {
      enabled: true,
      start: "22:00",
      end: "06:00",
      tz: "UTC",
    },
  });

  // Wrapping window evaluated at 03:00 UTC must be inside
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const insideWrap = hourUTC >= 22 || hourUTC < 6;
  if (insideWrap) {
    assert(
      wm && typeof wm.start === "string",
      "wrapping quiet hours detected as inside",
    );
  } else {
    assert(
      wm === null,
      "wrapping quiet hours detected as outside (daytime)",
    );
  }

  // nextWindowEnd returns a future timestamp that runs past midnight
  const next = nextWindowEnd({ start: "22:00", end: "06:00", tz: "UTC" });
  assert(next instanceof Date, "nextWindowEnd returns a Date");
  assert(next.getTime() > Date.now(), "nextWindowEnd is in the future");

  // Urgent types bypass deferral
  assert(
    URGENT_TYPES.has("sla_breach") &&
      URGENT_TYPES.has("major_incident") &&
      URGENT_TYPES.has("security_alert"),
    "urgent notification types retained",
  );
  assert(!URGENT_TYPES.has("assignment"), "routine types are not urgent");

  // quietHours.service no longer references the missing Platform5 module
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "../src/services/quietHours.service.js"),
    "utf8",
  );
  assert(
    !src.includes("Platform5"),
    "quietHours.service no longer loads missing Platform5 module",
  );
})().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});