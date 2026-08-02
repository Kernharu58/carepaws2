const cron = require("node-cron");
const logger = require("./utils/logger");
const { runVaccinationReminders, runDocumentExpiryReminders } = require("./jobs/reminderJobs");

/**
 * node-cron scheduler bootstrap. Called once from server.js after the DB
 * connection is established. Each job also supports a manual trigger via
 * POST /api/scheduled-jobs/:jobKey/run (see scheduledJobRoutes.js), which
 * reuses these same functions with triggeredBy: "manual".
 */
function startCronJobs() {
  // Every day at 7:00 AM server time.
  cron.schedule("0 7 * * *", async () => {
    logger.info("Running scheduled job: vaccination_reminders");
    await runVaccinationReminders();
  });

  // Every day at 7:15 AM server time.
  cron.schedule("15 7 * * *", async () => {
    logger.info("Running scheduled job: document_expiry_reminders");
    await runDocumentExpiryReminders();
  });

  logger.info("Cron jobs scheduled: vaccination_reminders (07:00), document_expiry_reminders (07:15)");
}

module.exports = startCronJobs;
