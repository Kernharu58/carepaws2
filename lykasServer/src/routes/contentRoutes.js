const express = require("express");
const router = express.Router();
const ContentItem = require("../models/ContentItem");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { contentCreateSchema, contentUpdateSchema } = require("../validators/content.schema");

router.get("/public", async (req, res, next) => {
  try {
    const filter = { isPublished: true };
    if (req.query.type) filter.type = req.query.type;
    const data = await ContentItem.find(filter).sort({ order: 1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/public/slug/:slug", async (req, res, next) => {
  try {
    const item = await ContentItem.findOne({ slug: req.params.slug, isPublished: true });
    if (!item) return res.status(404).json({ success: false, message: "Content not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const data = await ContentItem.find().sort({ type: 1, order: 1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Content not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, validateRequest(contentCreateSchema), async (req, res, next) => {
  try {
    const item = await ContentItem.create({ ...req.body, lastEditedBy: req.user._id });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, validateRequest(contentUpdateSchema), async (req, res, next) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Content not found" });

    Object.assign(item, req.body);
    item.version += 1;
    item.lastEditedBy = req.user._id;
    await item.save();

    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const item = await ContentItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Content not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
