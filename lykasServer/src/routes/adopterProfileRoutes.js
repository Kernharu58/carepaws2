const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Application = require("../models/Application");
const RiskAssessment = require("../models/RiskAssessment");
const { protect, adminOnly } = require("../middleware/authMiddleware");

async function buildProfile(userId) {
  const [user, applications, assessments] = await Promise.all([
    User.findById(userId),
    Application.find({ applicant: userId }).populate("pet").sort({ createdAt: -1 }),
    RiskAssessment.find({ applicant: userId }).sort({ createdAt: -1 }),
  ]);
  if (!user) return null;
  return { user, applications, riskAssessments: assessments };
}

// GET /api/adopter-profile — the current user's own adopter profile view
router.get("/", protect, async (req, res, next) => {
  try {
    const profile = await buildProfile(req.user._id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// GET /api/adopter-profile/:userId — staff
router.get("/:userId", protect, adminOnly, async (req, res, next) => {
  try {
    const profile = await buildProfile(req.params.userId);
    if (!profile) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
