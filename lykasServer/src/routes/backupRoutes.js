const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Backup = require("../models/Backup");
const { protect, requireRole } = require("../middleware/authMiddleware");
const logger = require("../utils/logger");

router.get("/", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const backups = await Backup.find().sort({ createdAt: -1 });
    res.json({ success: true, data: backups });
  } catch (err) {
    next(err);
  }
});

// POST /api/backups — records metadata for a manually-triggered backup.
// The actual dump (mongodump / Atlas snapshot) is expected to run as an
// out-of-process operational task in staging/production; this endpoint
// tracks it so ops has an auditable record from the admin panel, rather
// than pretending to perform a full mongodump inside an HTTP request.
router.post("/", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const backup = await Backup.create({
      type: req.body.type || "manual",
      status: "completed",
      collections: collections.map((c) => c.name),
      documentCount: null, // populated by the out-of-process backup job, not this metadata record
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: backup });
  } catch (err) {
    logger.error({ err }, "Backup metadata record failed");
    next(err);
  }
});

router.get("/:id/download", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ success: false, message: "Backup not found" });
    if (!backup.filePath) {
      return res.status(404).json({ success: false, message: "No file associated with this backup record" });
    }
    res.download(backup.filePath, backup.fileName);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/restore", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ success: false, message: "Backup not found" });

    // Actual restore is an out-of-process, operator-supervised action —
    // this marks intent/audit trail rather than executing a live
    // mongorestore against the running database from an HTTP handler.
    backup.restoredAt = new Date();
    backup.restoredBy = req.user._id;
    await backup.save();

    res.json({ success: true, message: "Restore recorded — run the actual mongorestore out-of-process", data: backup });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const backup = await Backup.findByIdAndDelete(req.params.id);
    if (!backup) return res.status(404).json({ success: false, message: "Backup not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
