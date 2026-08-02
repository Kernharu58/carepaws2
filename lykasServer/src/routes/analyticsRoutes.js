const express = require("express");
const router = express.Router();
const Pet = require("../models/Pet");
const Application = require("../models/Application");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/overview", protect, adminOnly, async (req, res, next) => {
  try {
    const [totalPets, totalApplications, adoptionRate] = await Promise.all([
      Pet.countDocuments({ isDeleted: { $ne: true } }),
      Application.countDocuments(),
      Application.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } } } },
      ]),
    ]);

    const rate = adoptionRate[0] ? adoptionRate[0].approved / Math.max(1, adoptionRate[0].total) : 0;
    res.json({ success: true, data: { totalPets, totalApplications, adoptionRate: rate } });
  } catch (err) {
    next(err);
  }
});

router.get("/trends", protect, adminOnly, async (req, res, next) => {
  try {
    const monthsBack = Number(req.query.months) || 6;
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);

    const trends = await Application.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.json({ success: true, data: trends });
  } catch (err) {
    next(err);
  }
});

router.get("/pets-breakdown", protect, adminOnly, async (req, res, next) => {
  try {
    const breakdown = await Pet.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: { species: "$species", status: "$status" }, count: { $sum: 1 } } },
    ]);
    res.json({ success: true, data: breakdown });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
