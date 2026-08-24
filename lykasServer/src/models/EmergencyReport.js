const mongoose = require("mongoose");

const emergencyReportSchema = new mongoose.Schema(
  {
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["stray_animal", "injured_animal", "abuse_report", "abandoned_animal", "other"], required: true },
    animalType: { type: String },
    description: { type: String, required: true },
    photos: [{ type: String }],
    location: { type: String },
    coordinates: { lat: Number, lng: Number },
    contactName: { type: String },
    contactPhone: { type: String },
    status: { type: String, enum: ["open", "in_progress", "resolved", "dismissed"], default: "open" },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String },
    linkedPet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmergencyReport", emergencyReportSchema);
