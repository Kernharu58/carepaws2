const express = require("express");
const router = express.Router();
const Shelter = require("../models/Shelter");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/summary", protect, adminOnly, async (req, res, next) => {
  try {
    const shelters = await Shelter.find();
    const totalCapacity = shelters.reduce((sum, s) => sum + (s.capacity || 0), 0);
    const totalOccupancy = shelters.reduce((sum, s) => sum + (s.currentOccupancy || 0), 0);
    res.json({ success: true, data: { count: shelters.length, totalCapacity, totalOccupancy } });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    const shelters = await Shelter.find(filter).sort({ name: 1 });
    res.json({ success: true, data: shelters });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: "Shelter not found" });
    res.json({ success: true, data: shelter });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const shelter = await Shelter.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: shelter });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const shelter = await Shelter.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!shelter) return res.status(404).json({ success: false, message: "Shelter not found" });
    res.json({ success: true, data: shelter });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const shelter = await Shelter.findByIdAndDelete(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: "Shelter not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
