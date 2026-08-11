const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { appointmentCreateSchema, appointmentUpdateSchema, appointmentEnrollSchema } = require("../validators/appointment.schema");

router.get("/", async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ status: { $ne: "Completed" } }).sort({ date: 1 });
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, validateRequest(appointmentCreateSchema), async (req, res, next) => {
  try {
    const appointment = await Appointment.create(req.body);
    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
});

// NOTE: GET /seed (a dev/test data-seeding helper in the original source)
// is deliberately excluded from this production build per §9/§11.6 — it
// has no place in a build real shelters depend on.

router.get("/my-appointments", protect, async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ user: req.user._id }).sort({ date: 1 });
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/enroll", protect, validateRequest(appointmentEnrollSchema), async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
    if (appointment.status === "Full") return res.status(409).json({ success: false, message: "Appointment is full" });

    appointment.user = req.user._id;
    appointment.phone = req.body.phone;
    appointment.emergencyContact = req.body.emergencyContact;
    appointment.notes = req.body.notes;
    appointment.appliedAt = new Date();
    if (appointment.capacity <= 1) appointment.status = "Full";
    await appointment.save();

    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/cancel", protect, async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    appointment.user = null;
    appointment.appliedAt = null;
    appointment.status = "Open";
    await appointment.save();

    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, validateRequest(appointmentUpdateSchema), async (req, res, next) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
