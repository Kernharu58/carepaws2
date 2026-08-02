const mongoose = require("mongoose");

const scheduledJobLogSchema = new mongoose.Schema(
  {
    jobKey: { type: String, required: true, index: true },
    label: { type: String },
    status: { type: String, enum: ["success", "failed"], default: "success" },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    durationMs: { type: Number },
    itemsProcessed: { type: Number, default: 0 },
    triggeredBy: { type: String, enum: ["cron", "manual"], default: "cron" },
    triggeredByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    message: { type: String },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScheduledJobLog", scheduledJobLogSchema);
