const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const ApiKey = require("../models/ApiKey");
const { protect, requireRole } = require("../middleware/authMiddleware");

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

router.get("/", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const keys = await ApiKey.find().select("-keyHash");
    res.json({ success: true, data: keys });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const rawKey = `cpk_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = rawKey.slice(0, 12);

    const apiKey = await ApiKey.create({
      name: req.body.name,
      keyHash: hashKey(rawKey),
      prefix,
      scopes: req.body.scopes || [],
      createdBy: req.user._id,
      expiresAt: req.body.expiresAt || null,
    });

    // The raw key is only ever shown once, at creation time.
    res.status(201).json({ success: true, data: { id: apiKey._id, name: apiKey.name, prefix, key: rawKey } });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const apiKey = await ApiKey.findByIdAndUpdate(req.params.id, { revoked: true, revokedAt: new Date() }, { new: true });
    if (!apiKey) return res.status(404).json({ success: false, message: "API key not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
