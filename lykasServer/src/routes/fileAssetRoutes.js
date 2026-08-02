const express = require("express");
const router = express.Router();
const cloudinary = require("../config/cloudinary");
const FileAsset = require("../models/FileAsset");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { uploadDocument } = require("../middleware/uploadMiddleware");

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const filter = { isDeleted: { $ne: true } };
    if (req.query.category) filter.category = req.query.category;
    const files = await FileAsset.find(filter).populate("uploadedBy", "displayName").sort({ createdAt: -1 });
    res.json({ success: true, data: files });
  } catch (err) {
    next(err);
  }
});

router.get("/storage-stats", protect, adminOnly, async (req, res, next) => {
  try {
    const stats = await FileAsset.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$category", count: { $sum: 1 }, totalBytes: { $sum: "$sizeBytes" } } },
    ]);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, uploadDocument.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: "carepaws/files", resource_type: "auto" }, (err, r) =>
        err ? reject(err) : resolve(r)
      );
      stream.end(req.file.buffer);
    });

    const file = await FileAsset.create({
      fileName: req.file.originalname,
      url: result.secure_url,
      publicId: result.public_id,
      category: req.body.category || "other",
      relatedModel: req.body.relatedModel,
      relatedId: req.body.relatedId,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const file = await FileAsset.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: "File not found" });

    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
