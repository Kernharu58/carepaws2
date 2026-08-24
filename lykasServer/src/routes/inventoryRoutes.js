const express = require("express");
const router = express.Router();
const InventoryItem = require("../models/InventoryItem");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");
const validateRequest = require("../middleware/validateRequest");
const { inventoryItemSchema, inventoryUpdateSchema, inventoryAdjustSchema } = require("../validators/inventory.schema");
const { applyManualMovement } = require("../utils/inventoryService");

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

router.get("/:id/movements", protect, adminOnly, async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id).select("name quantity unit movements");
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    const movements = [...item.movements].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: movements });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, validateRequest(inventoryItemSchema), async (req, res, next) => {
  try {
    const { quantity = 0, ...fields } = req.body;
    const item = new InventoryItem(fields);
    if (quantity > 0) {
      item.quantity = quantity;
      item.movements.push({ type: "restock", quantity, note: "Initial stock", actor: req.user._id, sourceType: "manual" });
      item.lastRestockedAt = new Date();
      item.lastRestockedBy = req.user._id;
    }
    await item.save();
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, validateRequest(inventoryUpdateSchema), async (req, res, next) => {
  try {
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/adjust", protect, adminOnly, validateRequest(inventoryAdjustSchema), async (req, res, next) => {
  try {
    const { type, quantity, note } = req.body;
    const item = await InventoryItem.findById(req.params.id).select("_id quantity");
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const updated = await applyManualMovement({ itemId: item._id, type, quantity, note, actor: req.user._id });
    if (!updated) {
      return res.status(409).json({ success: false, message: "Insufficient stock for this usage" });
    }

    res.json({ success: true, data: updated });
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
