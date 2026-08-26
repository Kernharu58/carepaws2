const ApiLog = require("../models/ApiLog");
const logger = require("../utils/logger");

// Diagnostic/keepalive endpoints under /api/system — hit by uptime
// monitors and load balancers, not by a person or either frontend, and
// never carry anything worth investigating later. Logging repeated,
// identical pings just spends ApiLog rows on pure noise. (The app's
// primary documented health check, GET /health — see SETUP.md and the
// server README — is already outside the "/api/" prefix this middleware
// is mounted on, so it never reaches here at all; this only needs to
// cover the secondary, more detailed diagnostic endpoints under
// /api/system.)
const UNLOGGED_PATHS = new Set(["/api/system/health", "/api/system/version"]);

// Defensive only: as of this fix, no route in this app accepts a token,
// password, or other secret via query string (verify-email and
// reset-password both take it in the POST body — see authRoutes.js), so
// nothing currently gets redacted here. This exists so that if a future
// route ever does put a credential in the URL, it doesn't end up sitting
// in ApiLog verbatim just because nobody remembered to update this file.
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "accesstoken",
  "refreshtoken",
  "password",
  "secret",
  "apikey",
  "api_key",
  "authorization",
]);

function sanitizeUrl(originalUrl) {
  const [pathname, query] = originalUrl.split("?");
  if (!query) return pathname;

  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, "[redacted]");
    }
  }
  return `${pathname}?${params.toString()}`;
}

function apiMonitor(req, res, next) {
  if (UNLOGGED_PATHS.has(req.originalUrl.split("?")[0])) {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;

    ApiLog.create({
      method: req.method,
      path: sanitizeUrl(req.originalUrl),
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?._id || null,
      ipAddress: req.ip,
    }).catch((err) => logger.error({ err }, "Failed to write ApiLog entry"));
  });

  next();
}

module.exports = apiMonitor;
// Named exports for unit testing the pure helpers directly (see
// models/Notification.js / routes/archiveRoutes.js for the same
// attach-to-module.exports pattern used elsewhere in this codebase).
module.exports.sanitizeUrl = sanitizeUrl;
module.exports.UNLOGGED_PATHS = UNLOGGED_PATHS;
