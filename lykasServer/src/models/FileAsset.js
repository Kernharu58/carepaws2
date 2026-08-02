const mongoose = require("mongoose");

const fileAssetSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String },
    category: { type: String, enum: ["adoption_document", "id_document", "medical_record", "image", "other"], required: true },
    relatedModel: { type: String },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FileAsset", fileAssetSchema);
