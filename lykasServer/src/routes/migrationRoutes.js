const express = require("express");
const router = express.Router();
const Migration = require("../models/Migration");
const { protect, requireRole } = require("../middleware/authMiddleware");

router.get("/", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const migrations = await Migration.find().sort({ appliedAt: -1 });
    res.json({ success: true, data: migrations });
  } catch (err) {
    next(err);
  }
});

// POST /api/migrations — records that a migration (run via a separate
// CLI script, not this HTTP handler) was applied, so it's visible from
// the admin panel's ops view.
router.post("/", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const migration = await Migration.create({ ...req.body, appliedBy: req.user._id });
    res.status(201).json({ success: true, data: migration });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
