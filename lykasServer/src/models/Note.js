const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    entityType: { type: String, enum: ["Pet", "User", "Volunteer", "InKindDonation", "Shelter"], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    visibility: { type: String, enum: ["internal"], default: "internal" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Note", noteSchema);
