const ApiLog = require("../models/ApiLog");
const logger = require("../utils/logger");

function apiMonitor(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;

    ApiLog.create({
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?._id || null,
      ipAddress: req.ip,
    }).catch((err) => logger.error({ err }, "Failed to write ApiLog entry"));
  });

  next();
}

module.exports = apiMonitor;
