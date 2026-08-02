const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Pet = require("../models/Pet");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// GET /api/duplicates/users — finds users sharing a normalized phone number
router.get("/users", protect, adminOnly, async (req, res, next) => {
  try {
    const groups = await User.aggregate([
      { $match: { phone: { $nin: [null, ""] }, isDeleted: { $ne: true } } },
      { $group: { _id: "$phone", users: { $push: { _id: "$_id", displayName: "$displayName", email: "$email" } }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
});

// GET /api/duplicates/pets — finds pets sharing a name + species (likely dupes)
router.get("/pets", protect, adminOnly, async (req, res, next) => {
  try {
    const groups = await Pet.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: { name: "$name", species: "$species" }, pets: { $push: { _id: "$_id", status: "$status" } }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
