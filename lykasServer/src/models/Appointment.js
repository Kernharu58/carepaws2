const mongoose = require("mongoose");

const appointmentRegistrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    phone: { type: String },
    emergencyContact: { type: String },
    notes: { type: String },
    appliedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["registered", "cancelled"], default: "registered" },
  },
  { _id: true }
);

const appointmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true },
    durationHours: { type: Number, default: 1, min: 0.25 },
    capacity: { type: Number, default: 1, min: 1 },
    // Legacy single-user fields are retained for existing records.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    phone: { type: String },
    emergencyContact: { type: String },
    notes: { type: String },
    appliedAt: { type: Date, default: null },
    registrations: { type: [appointmentRegistrationSchema], default: [] },
    status: { type: String, enum: ["Open", "Full", "Completed"], default: "Open" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
