const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

router.get("/version", (req, res) => {
  const { version } = require("../../package.json");
  res.json({ success: true, version, nodeEnv: process.env.NODE_ENV });
});

module.exports = router;
