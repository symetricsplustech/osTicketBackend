const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err instanceof ApiError) {
    error = err;
  } else if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(400, messages.join(', '));
  } else if (err.name === 'CastError') {
    error = new ApiError(400, `Invalid value for ${err.path}`);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new ApiError(409, `${field} already exists`);
  } else if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5MB)' : `Upload error: ${err.message}`;
    error = new ApiError(400, msg);
  } else {
    logger.error(`Unhandled: ${err.message}\n${err.stack}`);
    error = new ApiError(500, 'Internal server error');
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    details: error.details || undefined,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
};

module.exports = { notFound, errorHandler };
