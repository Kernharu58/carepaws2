const express = require("express");
const router = express.Router();
const Pet = require("../models/Pet");
const Application = require("../models/Application");
const Volunteer = require("../models/Volunteer");
const Payment = require("../models/Payment");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const [petsByStatus, pendingApplications, pendingVolunteers, revenueThisMonth] = await Promise.all([
      Pet.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Application.countDocuments({ status: "pending" }),
      Volunteer.countDocuments({ status: "pending" }),
      Payment.aggregate([
        { $match: { status: "paid", paidAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        petsByStatus,
        pendingApplications,
        pendingVolunteers,
        revenueThisMonthCentavos: revenueThisMonth[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
