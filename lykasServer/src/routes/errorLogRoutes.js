const express = require("express");
const router = express.Router();
const ErrorLog = require("../models/ErrorLog");
const { protect, requireRole } = require("../middleware/authMiddleware");

// POST /api/errors/report — frontends (admin/mobile) report their own errors here
router.post("/report", async (req, res, next) => {
  try {
    const { source, message, stack, route, severity, metadata } = req.body;
    const entry = await ErrorLog.create({ source, message, stack, route, severity, metadata });
    res.status(201).json({ success: true, data: { id: entry._id } });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.source) filter.source = req.query.source;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.resolved !== undefined) filter.resolved = req.query.resolved === "true";
    const logs = await ErrorLog.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/resolve", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const entry = await ErrorLog.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedBy: req.user._id, resolvedAt: new Date() },
      { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: "Error log entry not found" });
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
