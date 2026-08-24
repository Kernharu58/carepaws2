const mongoose = require("mongoose");

const shelterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: { lat: Number, lng: Number },
    contactPerson: { type: String },
    contactPhone: { type: String },
    contactEmail: { type: String },
    capacity: { type: Number, default: 0 },
    // Legacy persisted value retained for compatibility. Occupancy is derived from Pet.shelterId.
    currentOccupancy: { type: Number, default: 0, min: 0 },
    type: { type: String, enum: ["main_shelter", "foster_hub", "clinic", "satellite"], required: true },
    status: { type: String, enum: ["active", "at_capacity", "under_maintenance", "inactive"], default: "active" },
    operatingHours: { type: String },
    notes: { type: String },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shelter", shelterSchema);
