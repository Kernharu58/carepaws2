const express = require("express");
const router = express.Router();
const MonitoringReport = require("../models/MonitoringReport");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/my", protect, async (req, res, next) => {
  try {
    const data = await MonitoringReport.find({ submittedBy: req.user._id }).populate("pet").sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/flagged", protect, adminOnly, async (req, res, next) => {
  try {
    const data = await MonitoringReport.find({ status: "flagged" }).populate("pet submittedBy").sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/pet/:petId", protect, adminOnly, async (req, res, next) => {
  try {
    const data = await MonitoringReport.find({ pet: req.params.petId }).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    const report = await MonitoringReport.create({ ...req.body, submittedBy: req.user._id });
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const data = await MonitoringReport.find(filter).populate("pet submittedBy").sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", protect, async (req, res, next) => {
  try {
    const report = await MonitoringReport.findById(req.params.id).populate("pet submittedBy");
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/review", protect, adminOnly, async (req, res, next) => {
  try {
    const report = await MonitoringReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    report.status = req.body.status || "reviewed";
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.adminNotes = req.body.adminNotes;
    await report.save();

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
