const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    level: { type: String, enum: ["info", "warning", "critical"], default: "info" },
    audience: { type: String, enum: ["all", "admin", "user"], default: "all" },
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);
