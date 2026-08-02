const mongoose = require("mongoose");

const monitoringReportSchema = new mongoose.Schema(
  {
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    reportDate: { type: Date, default: Date.now },
    reportMonth: { type: String },
    petName: { type: String },
    currentWeight: { type: Number },
    diet: { type: String },
    exerciseRoutine: { type: String },
    vetVisits: { type: String },
    overallCondition: { type: String, enum: ["Excellent", "Good", "Fair", "Poor"], required: true },
    behaviorAtHome: { type: String },
    issuesOrConcerns: { type: String },
    additionalPets: { type: String },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    comments: { type: String },
    status: { type: String, enum: ["pending", "reviewed", "flagged"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    adminNotes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MonitoringReport", monitoringReportSchema);
