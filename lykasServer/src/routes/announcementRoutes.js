const express = require("express");
const router = express.Router();
const Announcement = require("../models/Announcement");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { announcementCreateSchema, announcementUpdateSchema } = require("../validators/announcement.schema");

router.get("/active", async (req, res, next) => {
  try {
    const now = new Date();
    const data = await Announcement.find({
      isActive: true,
      startAt: { $lte: now },
      $or: [{ endAt: null }, { endAt: { $gte: now } }],
      audience: { $in: ["all", "user"] },
    }).sort({ level: -1, startAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const data = await Announcement.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, validateRequest(announcementCreateSchema), async (req, res, next) => {
  try {
    const announcement = await Announcement.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, validateRequest(announcementUpdateSchema), async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found" });
    res.json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
