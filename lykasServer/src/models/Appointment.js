const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true },
    durationHours: { type: Number, default: 1 },
    capacity: { type: Number, default: 1 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    phone: { type: String },
    emergencyContact: { type: String },
    notes: { type: String },
    appliedAt: { type: Date, default: null },
    status: { type: String, enum: ["Open", "Full", "Completed"], default: "Open" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
