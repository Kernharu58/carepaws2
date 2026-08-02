const express = require("express");
const router = express.Router();
const Note = require("../models/Note");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/:entityType/:entityId", protect, adminOnly, async (req, res, next) => {
  try {
    const notes = await Note.find({ entityType: req.params.entityType, entityId: req.params.entityId })
      .populate("author", "displayName")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
});

router.post("/:entityType/:entityId", protect, adminOnly, async (req, res, next) => {
  try {
    const note = await Note.create({
      entityType: req.params.entityType,
      entityId: req.params.entityId,
      author: req.user._id,
      text: req.body.text,
    });
    res.status(201).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
