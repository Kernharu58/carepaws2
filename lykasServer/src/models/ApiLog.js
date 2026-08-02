const mongoose = require("mongoose");

const apiLogSchema = new mongoose.Schema({
  method: { type: String, required: true },
  path: { type: String, required: true },
  statusCode: { type: Number },
  durationMs: { type: Number },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("ApiLog", apiLogSchema);
