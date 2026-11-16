const ScheduledJobLog = require("../models/ScheduledJobLog");
const identity = require("../services/identityVerificationService");
const logger = require("../utils/logger");

async function runJob({ jobKey, label, triggeredBy, triggeredByUser, work }) {
  const startedAt = new Date();
  let status = "success";
  let message = null;
  let itemsProcessed = 0;
  try {
    itemsProcessed = await work();
  } catch (err) {
    status = "failed";
    message = err.message;
    logger.error({ err: { message: err.message } }, `${jobKey} failed`);
  }
  await ScheduledJobLog.create({ jobKey, label, status, startedAt, finishedAt: new Date(), durationMs: Date.now() - startedAt.getTime(), itemsProcessed, triggeredBy, triggeredByUser, message });
  return { status, itemsProcessed };
}

// Verified IDs past their expiry date -> "expired" (+ notification, history record).
const runIdentityExpiry = ({ triggeredBy = "cron", triggeredByUser = null } = {}) =>
  runJob({ jobKey: "identity_expiry", label: "Expire outdated identity documents", triggeredBy, triggeredByUser, work: () => identity.expireDueIdentities() });

// Deletes ID images whose retention period ended. Decision records are kept.
const runIdentityImageRetention = ({ triggeredBy = "cron", triggeredByUser = null } = {}) =>
  runJob({ jobKey: "identity_image_retention", label: "Delete identity images past retention", triggeredBy, triggeredByUser, work: () => identity.purgeStaleImages() });

module.exports = { runIdentityExpiry, runIdentityImageRetention };
