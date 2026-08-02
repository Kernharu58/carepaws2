const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/", async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put("/", protect, adminOnly, async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      Object.assign(settings, req.body);
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
