const app = require("../src/app");
const connectDB = require("../src/config/db");
const { ensureDefaults } = require("../src/bootstrap/ensureDefaults");

let cached = global.__ostPostgresConn;
if (!cached) {
  cached = global.__ostPostgresConn = { promise: null };
}

module.exports = async (req, res) => {
  const headers = {
    "Access-Control-Allow-Origin": req.headers.origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  try {
    if (!cached.promise) cached.promise = connectDB();
    await cached.promise;
    await ensureDefaults().catch((err) =>
      console.error("ensureDefaults failed:", err.message),
    );
  } catch (err) {
    cached.promise = null;
    res.writeHead(500, { ...headers, "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ success: false, message: "Database connection failed" }),
    );
    return;
  }
  app(req, res);
};
