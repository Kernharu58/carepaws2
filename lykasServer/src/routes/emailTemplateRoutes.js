const express = require("express");
const router = express.Router();
const EmailTemplate = require("../models/EmailTemplate");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { renderTemplate } = require("../utils/emailService");

router.get("/", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const templates = await EmailTemplate.find();
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

router.get("/:key", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({ key: req.params.key });
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

router.put("/:key", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOneAndUpdate(
      { key: req.params.key },
      { ...req.body, updatedBy: req.user._id },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// POST /api/email-templates/:key/preview — renders against sample data without sending
router.post("/:key/preview", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({ key: req.params.key });
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });

    const sampleData = req.body.sampleData || {};
    res.json({
      success: true,
      data: {
        subject: renderTemplate(template.subject, sampleData),
        bodyHtml: renderTemplate(template.bodyHtml, sampleData),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
