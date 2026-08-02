const mongoose = require("mongoose");

// Shelter-level singleton — extend as needed.
const settingsSchema = new mongoose.Schema(
  {
    address: { type: String },
    phone: { type: String },
    email: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
