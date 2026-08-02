const mongoose = require("mongoose");

const backupSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["manual", "automatic"], default: "manual" },
    status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
    filePath: { type: String },
    fileName: { type: String },
    sizeBytes: { type: Number },
    collections: [{ type: String }],
    documentCount: { type: Number },
    error: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Backup", backupSchema);
