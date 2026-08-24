const { Vaccination } = require("../models/MedicalRecord");
const { Foster, WeeklyFosterReport, getFosterReportDueDate } = require("../models/Foster");
const User = require("../models/User");
const UserDocument = require("../models/UserDocument");
const ScheduledJobLog = require("../models/ScheduledJobLog");
const { notify, notifyOnce } = require("../utils/notificationHelper");
const Application = require("../models/Application");
const MonitoringReport = require("../models/MonitoringReport");
const { MONITORING_PERIODS, getMonitoringSchedule } = require("../utils/monitoringSchedule");
const Notification = require("../models/Notification");
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
      await notifyOnce({
        recipient: vac.pet.owner._id || vac.pet.owner,
        type: "VACCINATION_DUE",
        title: "Vaccination due soon",
        message: `${vac.pet.name}'s ${vac.vaccineName} vaccination is due on ${vac.nextDueDate.toDateString()}.`,
        refModel: "Pet",
        refId: vac.pet._id,
        dedupeKey: `vaccination-due:${vac._id}:${vac.nextDueDate.getTime()}`,
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
      await notifyOnce({
        recipient: doc.user,
        type: "GENERAL",
        title: "A document on file is expiring soon",
        message: `Your ${doc.type.replace(/_/g, " ")} expires on ${doc.expiresAt.toDateString()}. Please upload a renewal.`,
        refModel: null,
        refId: null,
        dedupeKey: `document-expiry:${doc._id}:${doc.expiresAt.getTime()}`,
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

/**
 * Tracks weekly foster reports for every active trial.
 *
 * Missing weeks are represented by real WeeklyFosterReport records so a report
 * can transition from missing -> overdue -> submitted without creating a
 * second tracking system. Notifications are emitted only on the transition
 * into a due/overdue state.
 */
async function runFosterReportMonitoring({ triggeredBy = "cron", triggeredByUser = null } = {}) {
  const startedAt = new Date();
  let itemsProcessed = 0;
  let status = "success";
  let message = "";

  try {
    const now = new Date();
    const activeFosters = await Foster.find({
      status: "active",
      startDate: { $exists: true, $ne: null },
      expectedEndDate: { $exists: true, $ne: null },
      trialDurationDays: { $gte: 30, $lte: 60 },
    });

    const staff = await User.find({
      role: { $in: ["staff", "admin", "super_admin"] },
      status: "active",
      isDeleted: { $ne: true },
    }).select("_id");

    for (const foster of activeFosters) {
      const required = Math.ceil(Number(foster.trialDurationDays) / 7);
      let submittedCount = 0;

      for (let week = 1; week <= required; week += 1) {
        const dueDate = getFosterReportDueDate(foster, week);
        let report = await WeeklyFosterReport.findOne({
          foster: foster._id,
          weekNumber: week,
        });

        if (report?.status === "submitted") {
          if (!report.dueDate || report.dueDate.getTime() !== dueDate.getTime()) {
            report.dueDate = dueDate;
            await report.save();
          }
          submittedCount += 1;
          continue;
        }

        const isDue = dueDate <= now;
        const nextStatus = isDue ? "overdue" : "missing";

        if (!report) {
          report = await WeeklyFosterReport.create({
            foster: foster._id,
            pet: foster.pet,
            fosterer: foster.fosterer,
            weekNumber: week,
            dueDate,
            status: nextStatus,
          });
        } else if (
          report.status !== nextStatus ||
          !report.dueDate ||
          report.dueDate.getTime() !== dueDate.getTime()
        ) {
          report.status = nextStatus;
          report.dueDate = dueDate;
          await report.save();
        }

        if (isDue) {
          const notificationMessage = `Week ${week} foster report for the placement ending ${new Date(
            foster.expectedEndDate
          ).toDateString()} is due.`;

          if (foster.fosterer) {
            const sent = await notifyOnce({
              recipient: foster.fosterer,
              type: "FOSTER_REPORT_DUE",
              title: report.status === "overdue" ? "Foster weekly report overdue" : "Foster weekly report due",
              message: report.status === "overdue" ? `${notificationMessage.replace("is due.", "is overdue.")}` : notificationMessage,
              refModel: "Foster",
              refId: foster._id,
              dedupeKey: `foster-report:${foster._id}:week:${week}:fosterer:${report.status}`,
            });
            if (sent) itemsProcessed += 1;
          }

          if (report.status === "overdue") {
            for (const recipient of staff) {
              const sent = await notifyOnce({
                recipient: recipient._id,
                type: "FOSTER_REPORT_DUE",
                title: "Foster weekly report overdue",
                message: `${notificationMessage.replace("is due.", "is overdue.")}`,
                refModel: "Foster",
                refId: foster._id,
                dedupeKey: `foster-report:${foster._id}:week:${week}:staff:${recipient._id}:overdue`,
              });
              if (sent) itemsProcessed += 1;
            }
          }
        }
      }

      if (foster.weeklyReportsRequired !== required || foster.weeklyReportsSubmitted !== submittedCount) {
        foster.weeklyReportsRequired = required;
        foster.weeklyReportsSubmitted = submittedCount;
        await foster.save();
      }
    }
  } catch (err) {
    status = "failed";
    message = err.message;
    logger.error({ err }, "runFosterReportMonitoring failed");
  }

  await ScheduledJobLog.create({
    jobKey: "foster_report_monitoring",
    label: "Foster weekly report monitoring",
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
 * Maintains the post-adoption monitoring schedule for completed adoptions.
 *
 * Each completed adoption gets one MonitoringReport record per configured
 * monitoring period. The record is the schedule until the adopter submits it,
 * then the same record becomes the submitted report. This keeps the adoption,
 * adopter, pet, period, due date, and report in one persisted record and
 * prevents orphan monitoring records.
 */
async function runMonitoringReportMonitoring({ triggeredBy = "cron", triggeredByUser = null } = {}) {
  const startedAt = new Date();
  let itemsProcessed = 0;
  let status = "success";
  let message = "";

  try {
    const now = new Date();
    const applications = await Application.find({
      type: "adoption",
      status: "approved",
      stage: "completed",
    }).select("_id applicant pet type status stage stageHistory updatedAt");

    for (const application of applications) {
      for (const monitoringPeriod of MONITORING_PERIODS) {
        const schedule = getMonitoringSchedule(application, monitoringPeriod);
        if (!schedule) continue;

        let report = await MonitoringReport.findOne({
          application: application._id,
          monitoringPeriod,
        });

        if (!report) {
          report = await MonitoringReport.create({
            application: application._id,
            submittedBy: application.applicant,
            pet: application.pet,
            ...schedule,
            status: schedule.scheduledDate <= now ? "pending" : "scheduled",
          });
          itemsProcessed += 1;
        } else if (
          !report.submittedAt &&
          (report.scheduledDate?.getTime() !== schedule.scheduledDate.getTime() ||
            report.dueDate?.getTime() !== schedule.dueDate.getTime() ||
            report.reportMonth !== schedule.reportMonth)
        ) {
          report.scheduledDate = schedule.scheduledDate;
          report.dueDate = schedule.dueDate;
          report.reportMonth = schedule.reportMonth;
          await report.save();
        }

        if (report.submittedAt || report.status === "reviewed" || report.status === "flagged") continue;

        if (report.dueDate <= now && report.status !== "pending") {
          report.status = "pending";
          await report.save();
        }

        const reminderWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (report.dueDate > now && report.dueDate <= reminderWindow) {
          await notifyOnce({
            recipient: application.applicant,
            type: "MONITORING_REMINDER",
            title: "Post-adoption monitoring reminder",
            message: `Your monitoring check-in for ${report.reportMonth} is due on ${report.dueDate.toLocaleDateString()}.`,
            refModel: "MonitoringReport",
            refId: report._id,
            dedupeKey: `monitoring-reminder:${report._id}:${report.dueDate.getTime()}`,
          });
        }

        if (report.dueDate <= now) {
          const alreadyNotified = await Notification.exists({
            recipient: application.applicant,
            type: "MONITORING_REPORT_DUE",
            refModel: "MonitoringReport",
            refId: report._id,
          });

          if (!alreadyNotified) {
            await notify({
              recipient: application.applicant,
              type: "MONITORING_REPORT_DUE",
              title: "Post-adoption check-in due",
              message: `Your monitoring check-in for ${report.reportMonth} is due. Please submit an update for your adopted pet.`,
              refModel: "MonitoringReport",
              refId: report._id,
            });
            itemsProcessed += 1;
          }
        }
      }
    }
  } catch (err) {
    status = "failed";
    message = err.message;
    logger.error({ err }, "runMonitoringReportMonitoring failed");
  }

  await ScheduledJobLog.create({
    jobKey: "monitoring_report_monitoring",
    label: "Post-adoption monitoring",
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


module.exports = { runVaccinationReminders, runDocumentExpiryReminders, runFosterReportMonitoring, runMonitoringReportMonitoring };
