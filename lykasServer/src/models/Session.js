const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Hashed refresh token — never store the raw token (§11.6.2)
    refreshTokenHash: { type: String, required: true, select: false },
    ipAddress: { type: String },
    userAgent: { type: String },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, revoked: 1 });

module.exports = mongoose.model("Session", sessionSchema);
