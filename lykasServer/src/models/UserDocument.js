const mongoose = require("mongoose");
const { DOCUMENT_STATUSES, ID_TYPES } = require("../config/identity");

const userDocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Application documents only. A government ID is NEVER linked to an
    // application: identity verification is account-level and shared by
    // adoption and foster applications.
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", default: null },
    type: {
      type: String,
      enum: ["government_id", "proof_of_address", "proof_of_income", "house_photo", "pet_owner_agreement", "other"],
      required: true,
    },
    label: { type: String },

    // --- File ---------------------------------------------------------
    // `fileUrl` exists only on legacy records created before private
    // delivery; it is never returned by the API (see toJSON below) and is
    // only used server-side to proxy the file to authorised viewers.
    fileUrl: { type: String },
    // Private (authenticated) storage reference for new uploads.
    storage: {
      provider: { type: String },
      publicId: { type: String },
      resourceType: { type: String },
      deliveryType: { type: String },
    },
    fileType: { type: String },
    fileSize: { type: Number },
    // SHA-256 of the uploaded bytes: detects re-submission of an identical
    // image. Not a biometric and not derived from the image content.
    contentHash: { type: String, index: true },
    // Set when the image has been deleted under the retention rules. The
    // record, decision and history remain.
    fileRemovedAt: { type: Date, default: null },
    imageDeleteAfter: { type: Date, default: null },

    // --- Review state -------------------------------------------------
    // Application documents use pending/verified/rejected. Government IDs
    // use the full set and are only ever changed by identityVerificationService.
    status: { type: String, enum: DOCUMENT_STATUSES, default: "pending" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }, // only meaningful for ID-type documents
    rejectedReason: { type: String }, // reason for rejection / resubmission request
    notes: { type: String },

    // --- Government ID only -------------------------------------------
    idType: { type: String, enum: [...ID_TYPES, null], default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    submissionChannel: { type: String, enum: ["self", "staff_assisted", null], default: null },
    checklist: { type: mongoose.Schema.Types.Mixed, default: null },
    assessmentType: { type: String, default: null },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserDocument", default: null },
    supersededAt: { type: Date, default: null },
    // Reviewers who actually opened the image. Approval requires that the
    // approving reviewer is in this list: a decision cannot be recorded for a
    // document nobody looked at. Never returned to clients (see toJSON).
    reviewViews: [
      {
        _id: false,
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

userDocumentSchema.index({ user: 1, type: 1, status: 1 });
// At most ONE pending government ID per user. This is what makes double-taps,
// retries after a lost response and concurrent uploads safe: the second insert
// fails with E11000 instead of creating a duplicate review item.
userDocumentSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { type: "government_id", status: "pending" }, name: "one_pending_government_id_per_user" }
);

userDocumentSchema.virtual("isExpired").get(function isExpired() {
  return Boolean(this.expiresAt && this.expiresAt.getTime() <= Date.now());
});

// Never leak storage details. Clients get a flag and fetch the file through
// the authenticated endpoint (GET /api/identity/documents/:id/file).
userDocumentSchema.set("toJSON", {
  virtuals: true,
  transform(doc, ret) {
    ret.hasFile = Boolean((ret.storage && ret.storage.publicId) || ret.fileUrl) && !ret.fileRemovedAt;
    delete ret.fileUrl;
    delete ret.storage;
    delete ret.contentHash;
    delete ret.reviewViews;
    delete ret.id;
    delete ret.__v;
    return ret;
  },
});
userDocumentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("UserDocument", userDocumentSchema);
