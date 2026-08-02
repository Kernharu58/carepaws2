const mongoose = require("mongoose");

const archiveSchema = new mongoose.Schema(
  {
    sourceCollection: { type: String, required: true },
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Archive", archiveSchema);
