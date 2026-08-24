const express = require("express");
const router = express.Router();
const cloudinary = require("../config/cloudinary");
const EmergencyReport = require("../models/EmergencyReport");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { uploadImage } = require("../middleware/uploadMiddleware");
const { emergencyReportCreateSchema, emergencyReportUpdateSchema } = require("../validators/emergencyReport.schema");
const { notifyOnce } = require("../utils/notificationHelper");

async function uploadPhoto(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "carepaws/emergency-reports", resource_type: "image" }, (err, result) =>
      err ? reject(err) : resolve(result.secure_url)
    );
    stream.end(buffer);
  });
}

router.get("/my", protect, async (req, res, next) => {
  try {
    const data = await EmergencyReport.find({ submittedBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, uploadImage.array("photos", 5), validateRequest(emergencyReportCreateSchema), async (req, res, next) => {
  try {
    const uploadedPhotos = req.files?.length ? await Promise.all(req.files.map((file) => uploadPhoto(file.buffer))) : [];
    const report = await EmergencyReport.create({
      ...req.body,
      coordinates: req.body.coordinates ? (typeof req.body.coordinates === "string" ? JSON.parse(req.body.coordinates) : req.body.coordinates) : undefined,
      photos: uploadedPhotos.length ? uploadedPhotos : req.body.photos,
      submittedBy: req.user._id,
    });
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    const data = await EmergencyReport.find(filter).populate("submittedBy", "displayName email").populate("assignedTo", "displayName email").sort({ priority: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", protect, async (req, res, next) => {
  try {
    const report = await EmergencyReport.findById(req.params.id).populate("submittedBy", "displayName email").populate("assignedTo", "displayName email");
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    const isStaff = ["staff", "admin", "super_admin"].includes(req.user.role);
    if (!isStaff && String(report.submittedBy?._id || report.submittedBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not authorized to view this report" });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, validateRequest(emergencyReportUpdateSchema), async (req, res, next) => {
  try {
    const report = await EmergencyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const previous = { status: report.status, priority: report.priority, assignedTo: report.assignedTo, resolutionNote: report.resolutionNote };
    Object.assign(report, req.body);
    if (req.body.status === "resolved" || req.body.status === "dismissed") {
      report.resolvedBy = req.user._id;
      report.resolvedAt = new Date();
    } else if (req.body.status && req.body.status !== "resolved" && req.body.status !== "dismissed") {
      report.resolvedBy = null;
      report.resolvedAt = null;
    }
    await report.save();

    const statusChanged = previous.status !== report.status;
    const priorityChanged = previous.priority !== report.priority;
    const assignmentChanged = String(previous.assignedTo || "") !== String(report.assignedTo || "");
    const resolutionChanged = previous.resolutionNote !== report.resolutionNote;

    if ((statusChanged || priorityChanged || resolutionChanged) && report.submittedBy) {
      await notifyOnce({
        recipient: report.submittedBy,
        sender: req.user._id,
        type: "EMERGENCY_REPORT_UPDATE",
        title: statusChanged ? "Emergency report status updated" : "Emergency report updated",
        message: `Your emergency report is now ${report.status}${report.priority ? ` (${report.priority} priority)` : ""}${report.resolutionNote ? ` ${report.resolutionNote}` : ""}`,
        refModel: "EmergencyReport",
        refId: report._id,
        dedupeKey: `emergency-update:${report._id}:${report.updatedAt?.getTime() || Date.now()}`,
      });
    }
    if (assignmentChanged && report.assignedTo && String(report.assignedTo) !== String(req.user._id)) {
      await notifyOnce({
        recipient: report.assignedTo,
        sender: req.user._id,
        type: "EMERGENCY_REPORT_UPDATE",
        title: "Emergency report assigned",
        message: `An emergency report has been assigned to you (${report.priority} priority).`,
        refModel: "EmergencyReport",
        refId: report._id,
        dedupeKey: `emergency-assigned:${report._id}:${report.assignedTo}:${report.updatedAt?.getTime() || Date.now()}`,
      });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
