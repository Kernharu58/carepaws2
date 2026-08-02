const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    expiresAt: { type: Date, required: true },
    reason: {
      type: String,
      enum: ["logout", "account_suspended", "account_locked", "password_changed"],
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index — automatically prunes blacklist entries once the underlying
// token would have expired anyway, addressing the "blacklist grows
// forever" operational note in §9.
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("TokenBlacklist", tokenBlacklistSchema);
