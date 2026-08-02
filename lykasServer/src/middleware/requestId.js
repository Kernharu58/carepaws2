const { v4: uuidv4 } = require("uuid");

/**
 * Attaches a correlation ID to every request: reuses one supplied by the
 * client (e.g. from a mobile app retry) via X-Request-Id, or generates a
 * fresh one. Echoed back in the response header and available on
 * req.requestId for logger/ErrorLog attachment, so "a user reported an
 * error at 3pm" can actually be traced through the logs.
 */
function requestId(req, res, next) {
  const incoming = req.headers["x-request-id"];
  req.requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : uuidv4();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

module.exports = requestId;
