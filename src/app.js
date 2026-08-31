const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const config = require("./config/config");
require("./middleware/tenantScope");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

app.disable("etag");
app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin requests (no Origin header) and whitelisted origins
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return cb(null, true);
      }
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(helmet());
app.use(compression());

if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
  // Vercel's Node runtime pre-parses the request body into req.body and
  // consumes the stream, so Express body-parsers would throw "Invalid JSON".
  app.use((req, res, next) => {
    if (req.body && typeof req.body === "object") {
      req.rawBody = JSON.stringify(req.body);
    } else {
      req.rawBody = String(req.body || "");
    }
    next();
  });
} else {
  app.use(
    express.json({
      limit: "2mb",
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
}

// XSS input sanitization
const { sanitizeMiddleware } = require("./middleware/sanitize");
app.use(sanitizeMiddleware);

// i18n locale detection (§2.18)
const { i18nMiddleware } = require("./middleware/i18n");
app.use(i18nMiddleware);

// Field-masking read-path enforcement (§17.5/§23.7)
const { maskingMiddleware } = require("./middleware/masking");
app.use(maskingMiddleware);

// Global pagination guard — caps limit on all /api list endpoints
app.use("/api", (req, _res, next) => {
  if (req.query.limit) {
    const n = parseInt(req.query.limit, 10);
    if (n > 100) req.query.limit = "100";
  }
  next();
});

if (config.env === "development") {
  app.use(morgan("dev"));
}

// Stricter auth limiter: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

const limiter = rateLimit({
  windowMs: config.rateLimit.window * 60 * 1000,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);

// Usage-limit hard-block (§1.13) — fires when tenant exceeds plan limits
const { usageGuard } = require("./middleware/usageLimit");
app.use(usageGuard("apiCalls"));

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) =>
  res.json({ success: true, message: "osTicket MERN API", version: "1.0.0" }),
);

app.use("/api/v1", routes);

// Serve built frontends in production
if (config.env === "production") {
  const frontends = [
    { name: "customer", prefix: "/", dir: "../../frontend/customer/dist" },
    { name: "agent", prefix: "/agent", dir: "../../frontend/agent/dist" },
    { name: "admin", prefix: "/admin", dir: "../../frontend/admin/dist" },
    {
      name: "superadmin",
      prefix: "/superadmin",
      dir: "../../frontend/superadmin/dist",
    },
  ];
  for (const fe of frontends) {
    const feDir = path.resolve(__dirname, fe.dir);
    if (fs.existsSync(feDir)) {
      app.use(fe.prefix, express.static(feDir));
    }
  }
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads"))
      return next();
    const target = req.path.startsWith("/agent")
      ? "agent"
      : req.path.startsWith("/admin")
        ? "admin"
        : req.path.startsWith("/superadmin")
          ? "superadmin"
          : "customer";
    const feDir = path.resolve(
      __dirname,
      frontends.find((f) => f.name === target).dir,
    );
    const entry = path.join(feDir, "index.html");
    if (fs.existsSync(entry)) {
      return res.sendFile(entry);
    }
    return res.status(404).json({ success: false, message: "Not found" });
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
