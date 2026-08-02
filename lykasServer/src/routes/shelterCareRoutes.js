const express = require("express");
const router = express.Router();
const { HealthCheck, FeedingLog, BehavioralObservation, CageAssignment, QuarantinePeriod } = require("../models/ShelterCare");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// GET /api/shelter-care/summary/:petId — a rollup across all five sub-concerns
router.get("/summary/:petId", protect, adminOnly, async (req, res, next) => {
  try {
    const { petId } = req.params;
    const [latestHealth, latestFeeding, latestBehavior, activeCage, activeQuarantine] = await Promise.all([
      HealthCheck.findOne({ pet: petId }).sort({ date: -1 }),
      FeedingLog.findOne({ pet: petId }).sort({ date: -1 }),
      BehavioralObservation.findOne({ pet: petId }).sort({ date: -1 }),
      CageAssignment.findOne({ pet: petId, isActive: true }),
      QuarantinePeriod.findOne({ pet: petId, isActive: true }),
    ]);
    res.json({ success: true, data: { latestHealth, latestFeeding, latestBehavior, activeCage, activeQuarantine } });
  } catch (err) {
    next(err);
  }
});

// --- Health checks ---
router.post("/health-checks", protect, adminOnly, async (req, res, next) => {
  try {
    const doc = await HealthCheck.create({ ...req.body, checkedBy: req.user._id });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});
router.get("/health-checks/flagged", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await HealthCheck.find({ flagged: true }).populate("pet").sort({ date: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});
router.get("/health-checks/:petId", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await HealthCheck.find({ pet: req.params.petId }).sort({ date: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// --- Feeding logs ---
router.post("/feeding-logs", protect, adminOnly, async (req, res, next) => {
  try {
    const doc = await FeedingLog.create({ ...req.body, loggedBy: req.user._id });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});
router.get("/feeding-logs/:petId", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await FeedingLog.find({ pet: req.params.petId }).sort({ date: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// --- Behavioral observations ---
router.post("/behavioral-obs", protect, adminOnly, async (req, res, next) => {
  try {
    const doc = await BehavioralObservation.create({ ...req.body, observedBy: req.user._id });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});
router.get("/behavioral-obs/:petId", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await BehavioralObservation.find({ pet: req.params.petId }).sort({ date: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// --- Cage assignments ---
router.post("/cages", protect, adminOnly, async (req, res, next) => {
  try {
    // Release any existing active assignment for this pet before creating a new one.
    await CageAssignment.updateMany({ pet: req.body.pet, isActive: true }, { isActive: false, releasedAt: new Date() });
    const doc = await CageAssignment.create({ ...req.body, assignedBy: req.user._id });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});
router.get("/cages", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await CageAssignment.find({ isActive: true }).populate("pet");
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});
router.get("/cages/:petId", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await CageAssignment.find({ pet: req.params.petId }).sort({ assignedAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});
router.delete("/cages/:assignmentId", protect, adminOnly, async (req, res, next) => {
  try {
    const doc = await CageAssignment.findByIdAndUpdate(req.params.assignmentId, { isActive: false, releasedAt: new Date() }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Cage assignment not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// --- Quarantine periods ---
router.post("/quarantine", protect, adminOnly, async (req, res, next) => {
  try {
    const doc = await QuarantinePeriod.create({ ...req.body, startedBy: req.user._id });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});
router.get("/quarantine", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await QuarantinePeriod.find({ isActive: true }).populate("pet");
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});
router.get("/quarantine/:petId", protect, adminOnly, async (req, res, next) => {
  try {
    const docs = await QuarantinePeriod.find({ pet: req.params.petId }).sort({ startDate: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});
router.put("/quarantine/:id/end", protect, adminOnly, async (req, res, next) => {
  try {
    const doc = await QuarantinePeriod.findByIdAndUpdate(
      req.params.id,
      { isActive: false, endDate: new Date(), endedBy: req.user._id },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Quarantine period not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
