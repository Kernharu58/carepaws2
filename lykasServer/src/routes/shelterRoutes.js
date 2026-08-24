const express = require("express");
const router = express.Router();
const Shelter = require("../models/Shelter");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { getSheltersWithOccupancy, getShelterWithOccupancy } = require("../utils/shelterOccupancy");

router.get("/summary", protect, adminOnly, async (req, res, next) => {
  try {
    const shelters = await getSheltersWithOccupancy();
    const totalCapacity = shelters.reduce((sum, s) => sum + s.capacity, 0);
    const totalOccupancy = shelters.reduce((sum, s) => sum + s.currentOccupancy, 0);
    const availableCapacity = Math.max(0, totalCapacity - totalOccupancy);
    const occupancyPercentage = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 10000) / 100 : 0;
    res.json({ success: true, data: { count: shelters.length, totalCapacity, totalOccupancy, availableCapacity, occupancyPercentage } });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    const shelters = await getSheltersWithOccupancy(filter);
    res.json({ success: true, data: shelters });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const shelter = await getShelterWithOccupancy(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: "Shelter not found" });
    res.json({ success: true, data: shelter });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const { currentOccupancy, ...values } = req.body;
    const capacity = Math.max(0, Number(values.capacity) || 0);
    const shelter = await Shelter.create({ ...values, capacity, currentOccupancy: 0, createdBy: req.user._id });
    res.status(201).json({ success: true, data: { ...shelter.toObject(), currentOccupancy: 0, availableCapacity: capacity, occupancyPercentage: 0 } });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const { currentOccupancy, ...values } = req.body;
    if (values.capacity !== undefined) values.capacity = Math.max(0, Number(values.capacity) || 0);
    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: "Shelter not found" });

    if (values.capacity !== undefined) {
      const Pet = require("../models/Pet");
      const occupancy = await Pet.countDocuments({ shelterId: shelter._id, isDeleted: { $ne: true } });
      if (values.capacity < occupancy) {
        return res.status(409).json({ success: false, message: `Capacity cannot be lower than current occupancy (${occupancy})` });
      }
    }

    Object.assign(shelter, values);
    await shelter.save();
    const updated = await getShelterWithOccupancy(shelter._id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const Pet = require("../models/Pet");
    const assignedPets = await Pet.countDocuments({ shelterId: req.params.id, isDeleted: { $ne: true } });
    if (assignedPets > 0) {
      return res.status(409).json({ success: false, message: "Cannot delete a shelter with assigned pets" });
    }
    const shelter = await Shelter.findByIdAndDelete(req.params.id);
    if (!shelter) return res.status(404).json({ success: false, message: "Shelter not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
