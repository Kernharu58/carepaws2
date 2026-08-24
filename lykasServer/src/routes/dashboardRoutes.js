const express = require("express");
const router = express.Router();
const Pet = require("../models/Pet");
const Application = require("../models/Application");
const Volunteer = require("../models/Volunteer");
const Payment = require("../models/Payment");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { getSheltersWithOccupancy } = require("../utils/shelterOccupancy");

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const [petsByStatus, pendingApplications, pendingVolunteers, revenueThisMonth, shelters] = await Promise.all([
      Pet.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Application.countDocuments({ status: "pending" }),
      Volunteer.countDocuments({ status: "pending" }),
      Payment.aggregate([
        { $match: { status: "paid", paidAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      getSheltersWithOccupancy(),
    ]);

    res.json({
      success: true,
      data: {
        petsByStatus,
        pendingApplications,
        pendingVolunteers,
        revenueThisMonthCentavos: revenueThisMonth[0]?.total || 0,
        shelterStats: {
          count: shelters.length,
          totalCapacity: shelters.reduce((sum, shelter) => sum + shelter.capacity, 0),
          totalOccupancy: shelters.reduce((sum, shelter) => sum + shelter.currentOccupancy, 0),
          availableCapacity: shelters.reduce((sum, shelter) => sum + shelter.availableCapacity, 0),
          occupancyPercentage: (() => {
            const capacity = shelters.reduce((sum, shelter) => sum + shelter.capacity, 0);
            const occupancy = shelters.reduce((sum, shelter) => sum + shelter.currentOccupancy, 0);
            return capacity > 0 ? Math.round((occupancy / capacity) * 10000) / 100 : 0;
          })(),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
