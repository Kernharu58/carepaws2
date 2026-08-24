const mongoose = require("mongoose");

const monitoringReportSchema = new mongoose.Schema(
  {
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    monitoringPeriod: { type: Number, required: true, min: 1 },
    scheduledDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    reportDate: { type: Date, default: null },
    reportMonth: { type: String, required: true },
    petName: { type: String },
    currentWeight: { type: Number },
    diet: { type: String },
    exerciseRoutine: { type: String },
    vetVisits: { type: String },
    overallCondition: { type: String, enum: ["Excellent", "Good", "Fair", "Poor"] },
    behaviorAtHome: { type: String },
    issuesOrConcerns: { type: String },
    additionalPets: { type: String },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    comments: { type: String },
    status: { type: String, enum: ["scheduled", "pending", "reviewed", "flagged"], default: "scheduled", index: true },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    adminNotes: { type: String },
  },
  { timestamps: true }
);

monitoringReportSchema.index({ application: 1, monitoringPeriod: 1 }, { unique: true });

module.exports = mongoose.model("MonitoringReport", monitoringReportSchema);
