const express = require("express");
const router = express.Router();
const EmergencyReport = require("../models/EmergencyReport");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/my", protect, async (req, res, next) => {
  try {
    const data = await EmergencyReport.find({ submittedBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    const report = await EmergencyReport.create({ ...req.body, submittedBy: req.user._id });
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    const data = await EmergencyReport.find(filter).sort({ priority: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const report = await EmergencyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const report = await EmergencyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    Object.assign(report, req.body);
    if (req.body.status === "resolved" || req.body.status === "dismissed") {
      report.resolvedBy = req.user._id;
      report.resolvedAt = new Date();
    }
    await report.save();

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
