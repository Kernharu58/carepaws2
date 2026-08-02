const express = require("express");
const router = express.Router();
const InventoryItem = require("../models/InventoryItem");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");

router.get("/summary", protect, adminOnly, async (req, res, next) => {
  try {
    const lowStock = await InventoryItem.countDocuments({ $expr: { $lte: ["$quantity", "$minThreshold"] } });
    const totalItems = await InventoryItem.countDocuments();
    res.json({ success: true, data: { totalItems, lowStock } });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const filter = buildListQuery(req.query, { searchFields: ["name", "supplier"], filterFields: ["category"] });
    const sort = buildSort(req.query);
    const total = await InventoryItem.countDocuments(filter);
    const { page, limit, skip, ...paginationRest } = buildPagination(total, req.query.page, req.query.limit);
    const data = await InventoryItem.find(filter).sort(sort).skip(skip).limit(limit);
    res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const item = await InventoryItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/:id/adjust — logs a movement and updates quantity atomically
router.post("/:id/adjust", protect, adminOnly, async (req, res, next) => {
  try {
    const { type, quantity, note } = req.body;
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const delta = type === "usage" ? -Math.abs(quantity) : Math.abs(quantity);
    item.quantity = Math.max(0, item.quantity + delta);
    item.movements.push({ type, quantity, note, actor: req.user._id });
    if (type === "restock") {
      item.lastRestockedAt = new Date();
      item.lastRestockedBy = req.user._id;
    }
    await item.save();

    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
