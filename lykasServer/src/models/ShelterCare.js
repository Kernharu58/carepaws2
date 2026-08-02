const mongoose = require("mongoose");

// Five related sub-concerns, each its own schema/collection, all indexed
// on `pet` per §5.2.

const healthCheckSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    weight: { type: Number },
    temperature: { type: Number },
    condition: { type: String, enum: ["Excellent", "Good", "Fair", "Poor", "Critical"], required: true },
    notes: { type: String },
    flagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const feedingLogSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    meal: { type: String, enum: ["Morning", "Afternoon", "Evening"], required: true },
    foodType: { type: String },
    amount: { type: String },
    eaten: { type: String, enum: ["All", "Most", "Half", "Little", "None"], default: "All" },
    notes: { type: String },
  },
  { timestamps: true }
);

const behavioralObservationSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    observedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    mood: { type: String, enum: ["Happy", "Calm", "Anxious", "Aggressive", "Lethargic", "Playful"], required: true },
    sociability: { type: String, enum: ["Friendly", "Neutral", "Shy", "Aggressive"], required: true },
    notes: { type: String },
    flagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const cageAssignmentSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    cageNumber: { type: String, required: true },
    section: { type: String },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

const quarantinePeriodSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    reason: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = {
  HealthCheck: mongoose.model("HealthCheck", healthCheckSchema),
  FeedingLog: mongoose.model("FeedingLog", feedingLogSchema),
  BehavioralObservation: mongoose.model("BehavioralObservation", behavioralObservationSchema),
  CageAssignment: mongoose.model("CageAssignment", cageAssignmentSchema),
  QuarantinePeriod: mongoose.model("QuarantinePeriod", quarantinePeriodSchema),
};
