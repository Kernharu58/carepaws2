const express = require("express");
const router = express.Router();
const ApiLog = require("../models/ApiLog");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// GET /api/monitoring/api/summary
router.get("/summary", protect, adminOnly, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalRequests, errorCount, avgDuration] = await Promise.all([
      ApiLog.countDocuments({ createdAt: { $gte: since } }),
      ApiLog.countDocuments({ createdAt: { $gte: since }, statusCode: { $gte: 500 } }),
      ApiLog.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, avg: { $avg: "$durationMs" } } }]),
    ]);

    res.json({
      success: true,
      data: {
        windowHours: 24,
        totalRequests,
        errorCount,
        avgDurationMs: avgDuration[0]?.avg || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
