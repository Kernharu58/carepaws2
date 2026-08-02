const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Archive = require("../models/Archive");
const { protect, requireRole } = require("../middleware/authMiddleware");

router.get("/", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.sourceCollection) filter.sourceCollection = req.query.sourceCollection;
    const archived = await Archive.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: archived });
  } catch (err) {
    next(err);
  }
});

// POST /api/archive/:collection — archives a document out of its normal
// collection entirely (the "second-tier trash can" per §5.1), not just
// the isDeleted soft-delete flag.
router.post("/:collection", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const { collection } = req.params;
    const { id, reason } = req.body;

    const model = mongoose.models[collection];
    if (!model) return res.status(400).json({ success: false, message: `Unknown collection: ${collection}` });

    const doc = await model.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    const archived = await Archive.create({
      sourceCollection: collection,
      originalId: doc._id,
      data: doc.toObject(),
      reason,
      archivedBy: req.user._id,
    });

    await model.findByIdAndDelete(id);

    res.status(201).json({ success: true, data: archived });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/restore", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const archived = await Archive.findById(req.params.id);
    if (!archived) return res.status(404).json({ success: false, message: "Archive entry not found" });

    const model = mongoose.models[archived.sourceCollection];
    if (!model) return res.status(400).json({ success: false, message: `Unknown collection: ${archived.sourceCollection}` });

    const { _id, ...data } = archived.data;
    await model.create({ ...data, _id: archived.originalId });

    archived.restoredAt = new Date();
    archived.restoredBy = req.user._id;
    await archived.save();

    res.json({ success: true, data: archived });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
