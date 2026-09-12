const { randomUUID } = require("crypto");

const HEADER = "x-correlation-id";

module.exports = function correlationId(req, res, next) {
  const id = req.headers[HEADER] || randomUUID();
  req.correlationId = id;
  res.setHeader(HEADER, id);
  next();
};
