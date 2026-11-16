const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { IDENTITY_STATUSES } = require("../config/identity");

// Fields that make up the identity-verification state. Only the identity
// service may change them; every other writer is rejected below.
const IDENTITY_FIELDS = [
  "identityVerificationStatus",
  "identityDocument",
  "identityVerifiedBy",
  "identityVerifiedAt",
  "identityExpiresAt",
  "identityVerificationNotes",
];
// Option key the identity service passes on its own update queries.
const IDENTITY_WRITE_OPTION = "identityServiceWrite";

const userSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, select: false },
    // Set whenever the password is (re)hashed — lets authMiddleware.protect
    // reject access tokens issued before a reset/change, closing the gap
    // where a stolen token would otherwise stay valid until its own natural
    // (15 min) expiry even after the password that could mint it changes.
    passwordChangedAt: { type: Date, default: null },

    // Consent record (Privacy Policy + User Agreement), captured at sign-up.
    privacyAccepted: { type: Boolean, default: false },
    privacyAcceptedAt: { type: Date, default: null },
    privacyPolicyVersion: { type: String, default: null },

    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    // Resend throttling (per user): last send time, plus a rolling window
    // counter. Kept on the user so the limit survives restarts and holds
    // across instances without needing Redis.
    emailVerificationLastSentAt: { type: Date, select: false },
    emailVerificationWindowStartedAt: { type: Date, select: false },
    emailVerificationSendCount: { type: Number, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    role: {
      type: String,
      enum: ["user", "staff", "admin", "super_admin"],
      default: "user",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "locked"],
      default: "active",
      index: true,
    },
    lockedUntil: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },

    profilePicture: { type: String, default: null },
    notificationsEnabled: { type: Boolean, default: true },
    pushToken: { type: String, default: null }, // NEW — §6.6, completes the push-notification loop

    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pet" }],
    volunteerHours: { type: Number, default: 0 },

    phone: { type: String, default: null },
    address: { type: String, default: null },
    phoneVerified: { type: Boolean, default: false },
    addressConfirmed: { type: Boolean, default: false },

    // Housing details, saved once in Settings and copied onto each application.
    isRenting: { type: Boolean, default: false },
    // Photo of the landlord's written OK for pets, so staff can check it.
    landlordProofUrl: { type: String, default: null },

    // Identity verification (government ID). Independent of emailVerified.
    // This is a cache derived from the ONE authoritative government-ID
    // UserDocument referenced by `identityDocument`; it is only ever written
    // by services/identityVerificationService.js (guarded below).
    identityVerificationStatus: {
      type: String,
      enum: IDENTITY_STATUSES,
      default: "unverified",
    },
    identityDocument: { type: mongoose.Schema.Types.ObjectId, ref: "UserDocument", default: null },
    identityVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    identityVerifiedAt: { type: Date, default: null },
    // Expiry of the authoritative document, denormalised for cheap checks.
    identityExpiresAt: { type: Date, default: null },
    // Reason shown to the applicant after a rejection / resubmission request.
    identityVerificationNotes: { type: String, default: null },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Defence in depth: the REST layer already has no direct "set status" endpoint,
// but a future code path must not be able to mark someone verified by saving a
// User document or running a bare update either.
userSchema.pre("save", function guardIdentityFields() {
  if (this.isNew) {
    // New accounts always start unverified, whatever the caller supplied.
    if (this.identityVerificationStatus !== "unverified" && !this.$locals?.identityServiceWrite) {
      this.identityVerificationStatus = "unverified";
      this.identityDocument = null;
      this.identityVerifiedBy = null;
      this.identityVerifiedAt = null;
      this.identityExpiresAt = null;
    }
    return;
  }
  if (this.$locals?.identityServiceWrite) return;
  const touched = IDENTITY_FIELDS.filter((f) => this.isModified(f));
  if (touched.length > 0) {
    throw Object.assign(new Error("Identity verification fields can only be changed through the identity verification service"), { statusCode: 403 });
  }
});

function guardIdentityUpdate() {
  if (this.getOptions()[IDENTITY_WRITE_OPTION] === true) return;
  const update = this.getUpdate() || {};
  const flat = [update, update.$set, update.$unset, update.$setOnInsert].filter(Boolean);
  for (const part of flat) {
    for (const key of Object.keys(part)) {
      if (IDENTITY_FIELDS.includes(key)) {
        throw Object.assign(new Error("Identity verification fields can only be changed through the identity verification service"), { statusCode: 403 });
      }
    }
  }
}
for (const op of ["updateOne", "updateMany", "findOneAndUpdate"]) userSchema.pre(op, guardIdentityUpdate);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function isLocked() {
  return this.status === "locked" && this.lockedUntil && this.lockedUntil > new Date();
};

const User = mongoose.model("User", userSchema);
User.IDENTITY_WRITE_OPTION = IDENTITY_WRITE_OPTION;
module.exports = User;