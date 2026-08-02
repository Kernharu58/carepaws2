const mongoose = require("mongoose");

const userDocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", default: null },
    type: {
      type: String,
      enum: ["government_id", "proof_of_address", "proof_of_income", "house_photo", "pet_owner_agreement", "other"],
      required: true,
    },
    label: { type: String },
    fileUrl: { type: String, required: true },
    fileType: { type: String },
    fileSize: { type: Number },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }, // only meaningful for ID-type documents
    rejectedReason: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserDocument", userDocumentSchema);
