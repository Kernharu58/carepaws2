const mongoose = require("mongoose");

/**
 * Append-only audit trail of every identity-verification event. A row is
 * written for each submission, decision, replacement, expiry, image purge and
 * reconciliation, and is never updated or deleted by application code — so the
 * history survives an applicant replacing or deleting an ID image.
 *
 * It deliberately stores no ID numbers, no image content and no file URLs.
 */
const ACTIONS = [
  "submitted",
  "staff_assisted_submission",
  "approved",
  "rejected",
  "resubmission_requested",
  "revoked",
  "expired",
  "superseded",
  "withdrawn",
  "image_purged",
  "status_reconciled",
  "legacy_migrated",
];

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    document: { type: mongoose.Schema.Types.ObjectId, ref: "UserDocument", default: null, index: true },
    action: { type: String, enum: ACTIONS, required: true },
    // User-level identity status before/after.
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },
    // Document-level status before/after.
    documentFromStatus: { type: String, default: null },
    documentToStatus: { type: String, default: null },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = system job
    actorRole: { type: String, default: null },
    reason: { type: String, default: null },
    checklist: { type: mongoose.Schema.Types.Mixed, default: null },
    assessmentType: { type: String, default: null },
    idType: { type: String, default: null },
    documentExpiresAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

function blocked() {
  throw new Error("IdentityVerificationRecord is append-only");
}
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  schema.pre(op, blocked);
}
schema.pre("save", function appendOnly() {
  if (!this.isNew) blocked();
});

const Model = mongoose.model("IdentityVerificationRecord", schema);
Model.ACTIONS = ACTIONS;
module.exports = Model;
