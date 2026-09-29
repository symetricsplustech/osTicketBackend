const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err instanceof ApiError) {
    error = err;
  } else if (err.code === "22P02" || /invalid input syntax for type uuid/i.test(err.message || "")) {
    // PostgreSQL invalid UUID (e.g. old Mongo ObjectId token like
    // "6a92f166dc48b8a5932d5650" hitting a uuid column). Never surface as 500;
    // treat as an expired/invalid session on auth paths, otherwise 400.
    const isAuthPath = /\/auth|\/login|\/me|\/modules|\/notifications|\/platform\/overview|\/search/i.test(
      req.originalUrl || "",
    );
    // Log at warn not error to avoid noise from stale frontend tokens
    logger.warn(`Invalid UUID on ${req.method} ${req.originalUrl}: ${err.message}`);
    error = new ApiError(
      isAuthPath ? 401 : 400,
      isAuthPath
        ? "Session expired, please login again"
        : "Invalid identifier format",
    );
  } else if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(400, messages.join(", "));
  } else if (err.name === "CastError") {
    error = new ApiError(400, `Invalid value for ${err.path}`);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    error = new ApiError(409, `${field} already exists`);
  } else if (err.name === "MulterError") {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large (max 5MB)"
        : `Upload error: ${err.message}`;
    error = new ApiError(400, msg);
  } else {
    logger.error(`Unhandled: ${err.message}\n${err.stack}`);
    error = new ApiError(500, "Internal server error");
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    details: error.details || undefined,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
};

module.exports = { notFound, errorHandler };
