const { Vaccination } = require("../models/MedicalRecord");
const UserDocument = require("../models/UserDocument");
const ScheduledJobLog = require("../models/ScheduledJobLog");
const { notify } = require("../utils/notificationHelper");
const logger = require("../utils/logger");

/**
 * Reminder emails/notifications for upcoming appointments and follow-ups.
 * Every run is logged to ScheduledJobLog (status, duration, items
 * processed, who/what triggered it) so ops can audit job health from the
 * admin panel (§4).
 */
async function runVaccinationReminders({ triggeredBy = "cron", triggeredByUser = null } = {}) {
  const startedAt = new Date();
  let itemsProcessed = 0;
  let status = "success";
  let message = "";

  try {
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const dueVaccinations = await Vaccination.find({
      nextDueDate: { $lte: inTwoWeeks, $gte: new Date() },
    }).populate({ path: "pet", populate: { path: "owner" } });

    for (const vac of dueVaccinations) {
      if (!vac.pet?.owner) continue;
      await notify({
        recipient: vac.pet.owner._id || vac.pet.owner,
        type: "VACCINATION_DUE",
        title: "Vaccination due soon",
        message: `${vac.pet.name}'s ${vac.vaccineName} vaccination is due on ${vac.nextDueDate.toDateString()}.`,
        refModel: "Pet",
        refId: vac.pet._id,
      });
      itemsProcessed += 1;
    }
  } catch (err) {
    status = "failed";
    message = err.message;
    logger.error({ err }, "runVaccinationReminders failed");
  }

  await ScheduledJobLog.create({
    jobKey: "vaccination_reminders",
    label: "Vaccination due reminders",
    status,
    startedAt,
    finishedAt: new Date(),
    durationMs: Date.now() - startedAt.getTime(),
    itemsProcessed,
    triggeredBy,
    triggeredByUser,
    message,
  });

  return { status, itemsProcessed };
}

/**
 * Flags UserDocuments (ID documents) that are approaching expiry so staff
 * can follow up before an adopter's on-file ID lapses.
 */
async function runDocumentExpiryReminders({ triggeredBy = "cron", triggeredByUser = null } = {}) {
  const startedAt = new Date();
  let itemsProcessed = 0;
  let status = "success";
  let message = "";

  try {
    const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiring = await UserDocument.find({
      expiresAt: { $lte: inThirtyDays, $gte: new Date() },
      status: "verified",
    });

    for (const doc of expiring) {
      await notify({
        recipient: doc.user,
        type: "GENERAL",
        title: "A document on file is expiring soon",
        message: `Your ${doc.type.replace(/_/g, " ")} expires on ${doc.expiresAt.toDateString()}. Please upload a renewal.`,
        refModel: null,
        refId: null,
      });
      itemsProcessed += 1;
    }
  } catch (err) {
    status = "failed";
    message = err.message;
    logger.error({ err }, "runDocumentExpiryReminders failed");
  }

  await ScheduledJobLog.create({
    jobKey: "document_expiry_reminders",
    label: "Expiring document reminders",
    status,
    startedAt,
    finishedAt: new Date(),
    durationMs: Date.now() - startedAt.getTime(),
    itemsProcessed,
    triggeredBy,
    triggeredByUser,
    message,
  });

  return { status, itemsProcessed };
}

module.exports = { runVaccinationReminders, runDocumentExpiryReminders };
