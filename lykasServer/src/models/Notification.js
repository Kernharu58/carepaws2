const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "APPLICATION_SUBMITTED", "APPLICATION_APPROVED", "APPLICATION_REJECTED", "APPLICATION_CANCELLED",
  "INTERVIEW_SCHEDULED", "INTERVIEW_RESCHEDULED", "INTERVIEW_CANCELLED", "INTERVIEW_RESULT",
  "HOME_VISIT_SCHEDULED", "HOME_VISIT_RESCHEDULED", "HOME_VISIT_CANCELLED", "HOME_VISIT_RESULT",
  "FOSTER_STARTED", "FOSTER_ENDED", "FOSTER_REPORT_DUE", "FOSTER_REPORT_REVIEWED",
  "MONITORING_REPORT_DUE", "MONITORING_REPORT_REVIEWED", "MONITORING_REPORT_FLAGGED",
  "EVENT_CREATED", "EVENT_REMINDER", "EVENT_CANCELLED",
  "VACCINATION_DUE", "HEALTH_CHECK_FLAGGED",
  "PAYMENT_RECEIVED", "PAYMENT_FAILED",
  "GENERAL",
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    refModel: {
      type: String,
      enum: ["Application", "Interview", "HomeVisit", "Foster", "MonitoringReport", "Event", "Pet", "Payment", null],
      default: null,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
