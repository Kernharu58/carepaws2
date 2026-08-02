const logger = require("../utils/logger");
const ErrorLog = require("../models/ErrorLog");

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;

  logger.error({ err, requestId: req.requestId, path: req.originalUrl, method: req.method }, err.message);

  ErrorLog.create({
    source: "server",
    message: err.message,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method,
    statusCode,
    userId: req.user?._id || null,
    severity: statusCode >= 500 ? "error" : "warning",
    metadata: { requestId: req.requestId },
  }).catch((logErr) => logger.error({ logErr }, "Failed to write ErrorLog entry"));

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? "Internal server error" : err.message,
    requestId: req.requestId,
  });
}

module.exports = { notFoundHandler, errorHandler };
