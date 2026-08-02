const AuditLog = require("../models/AuditLog");
const logger = require("./logger");

/**
 * Writes an AuditLog entry for a staff-performed mutation. Every route
 * that mutates a protected resource should call this (§7.3, §11.6.9).
 * Never throws — an audit-log write failure shouldn't fail the request
 * it's describing, but it is logged loudly so it doesn't go unnoticed.
 */
async function writeAuditLog({
  actor,
  action,
  targetUser = null,
  entityType = null,
  entityId = null,
  previousValues = null,
  newValues = null,
  metadata = null,
  req = null,
}) {
  try {
    await AuditLog.create({
      actor,
      action,
      targetUser,
      entityType,
      entityId,
      previousValues,
      newValues,
      metadata,
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (err) {
    logger.error({ err, action, entityType, entityId }, "Failed to write audit log");
  }
}

module.exports = { writeAuditLog };
