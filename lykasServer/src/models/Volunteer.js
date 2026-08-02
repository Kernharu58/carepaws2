const mongoose = require("mongoose");

const emergencyContactSchema = new mongoose.Schema(
  { name: String, phone: String, relationship: String },
  { _id: false }
);

const volunteerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    phone: { type: String },
    address: { type: String },
    motivation: { type: String },
    availability: [{ type: String, enum: ["Weekday mornings", "Weekday afternoons", "Weekends", "Flexible"] }],
    skills: [{ type: String }],
    emergencyContact: emergencyContactSchema,
    status: { type: String, enum: ["pending", "approved", "rejected", "inactive"], default: "pending", index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date, default: null },
    totalHours: { type: Number, default: 0 },
    notes: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Volunteer", volunteerSchema);
