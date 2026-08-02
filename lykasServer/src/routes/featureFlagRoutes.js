const express = require("express");
const router = express.Router();
const FeatureFlag = require("../models/FeatureFlag");
const { protect, requireRole } = require("../middleware/authMiddleware");

router.get("/public", async (req, res, next) => {
  try {
    const flags = await FeatureFlag.find().select("key enabled");
    res.json({ success: true, data: flags });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const flags = await FeatureFlag.find();
    res.json({ success: true, data: flags });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const flag = await FeatureFlag.create({ ...req.body, updatedBy: req.user._id });
    res.status(201).json({ success: true, data: flag });
  } catch (err) {
    next(err);
  }
});

router.put("/:key", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const flag = await FeatureFlag.findOneAndUpdate(
      { key: req.params.key },
      { ...req.body, updatedBy: req.user._id },
      { new: true }
    );
    if (!flag) return res.status(404).json({ success: false, message: "Feature flag not found" });
    res.json({ success: true, data: flag });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
