const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Payment = require("../models/Payment");
const Volunteer = require("../models/Volunteer");
const { HealthCheck } = require("../models/ShelterCare");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/adoptions", protect, adminOnly, async (req, res, next) => {
  try {
    const data = await Application.aggregate([
      { $match: { type: "adoption" } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/financial", protect, adminOnly, async (req, res, next) => {
  try {
    const data = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$type", totalCentavos: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/volunteers", protect, adminOnly, async (req, res, next) => {
  try {
    const data = await Volunteer.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 }, totalHours: { $sum: "$totalHours" } } },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/welfare", protect, adminOnly, async (req, res, next) => {
  try {
    const flaggedHealthChecks = await HealthCheck.countDocuments({ flagged: true });
    const conditionBreakdown = await HealthCheck.aggregate([{ $group: { _id: "$condition", count: { $sum: 1 } } }]);
    res.json({ success: true, data: { flaggedHealthChecks, conditionBreakdown } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
