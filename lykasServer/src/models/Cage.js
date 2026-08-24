const mongoose = require("mongoose");

const cageSchema = new mongoose.Schema(
  {
    shelterId: { type: mongoose.Schema.Types.ObjectId, ref: "Shelter", required: true, index: true },
    cageNumber: { type: String, required: true, trim: true },
    section: { type: String, trim: true, default: "" },
    capacity: { type: Number, required: true, min: 1, default: 1 },
    status: { type: String, enum: ["active", "maintenance", "inactive"], default: "active", index: true },
    quarantineOnly: { type: Boolean, default: false },
    allowedSpecies: {
      type: [{ type: String, enum: ["Dog", "Cat", "Other"] }],
      default: ["Dog", "Cat", "Other"],
    },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

cageSchema.index({ shelterId: 1, cageNumber: 1 }, { unique: true });

module.exports = mongoose.model("Cage", cageSchema);
