const HomeVisit = require("../models/HomeVisit");
const Application = require("../models/Application");
const { notify } = require("../utils/notificationHelper");

async function myHomeVisits(req, res, next) {
  try {
    const data = await HomeVisit.find({ applicant: req.user._id }).populate("pet").sort({ scheduledDate: 1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const application = await Application.findById(req.body.application).select("applicant pet status type");
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });
    if (application.status === "rejected") return res.status(409).json({ success: false, message: "Cannot schedule a home visit for a rejected application" });

    const visit = await HomeVisit.create({
      ...req.body,
      applicant: application.applicant,
      pet: application.pet,
    });
    await notify({
      recipient: visit.applicant,
      type: "HOME_VISIT_SCHEDULED",
      title: "Home visit scheduled",
      message: `Your home visit is scheduled for ${new Date(visit.scheduledDate).toLocaleString()}.`,
      refModel: "HomeVisit",
      refId: visit._id,
    });
    return res.status(201).json({ success: true, data: visit });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const data = await HomeVisit.find().populate("applicant pet assignedTo").sort({ scheduledDate: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const visit = await HomeVisit.findById(req.params.id).populate("applicant pet assignedTo application");
    if (!visit) return res.status(404).json({ success: false, message: "Home visit not found" });
    return res.json({ success: true, data: visit });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await HomeVisit.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Home visit not found" });

    const updates = { ...req.body };
    if (updates.application) {
      const application = await Application.findById(updates.application).select("applicant pet status");
      if (!application) return res.status(404).json({ success: false, message: "Application not found" });
      if (application.status === "rejected") return res.status(409).json({ success: false, message: "Cannot assign a home visit to a rejected application" });
      updates.applicant = application.applicant;
      updates.pet = application.pet;
    } else {
      updates.applicant = existing.applicant;
      updates.pet = existing.pet;
    }

    const visit = await HomeVisit.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    await notify({
      recipient: visit.applicant,
      type: "HOME_VISIT_RESCHEDULED",
      title: "Home visit rescheduled",
      message: `Your home visit has been updated to ${new Date(visit.scheduledDate).toLocaleString()}.`,
      refModel: "HomeVisit",
      refId: visit._id,
    });
    return res.json({ success: true, data: visit });
  } catch (err) {
    next(err);
  }
}

async function complete(req, res, next) {
  try {
    const visit = await HomeVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: "Home visit not found" });

    visit.status = "completed";
    visit.report = req.body.report;
    visit.result = req.body.result;
    visit.notes = req.body.notes;
    visit.completedAt = new Date();
    await visit.save();

    await notify({
      recipient: visit.applicant,
      type: "HOME_VISIT_RESULT",
      title: "Home visit result available",
      message: `Your home visit result: ${visit.result}.`,
      refModel: "HomeVisit",
      refId: visit._id,
    });

    return res.json({ success: true, data: visit });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const visit = await HomeVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: "Home visit not found" });

    visit.status = "cancelled";
    visit.cancelReason = req.body.cancelReason;
    await visit.save();

    await notify({
      recipient: visit.applicant,
      type: "HOME_VISIT_CANCELLED",
      title: "Home visit cancelled",
      message: visit.cancelReason || "Your home visit has been cancelled.",
      refModel: "HomeVisit",
      refId: visit._id,
    });

    return res.json({ success: true, data: visit });
  } catch (err) {
    next(err);
  }
}

async function noShow(req, res, next) {
  try {
    const visit = await HomeVisit.findByIdAndUpdate(req.params.id, { status: "no-show" }, { new: true });
    if (!visit) return res.status(404).json({ success: false, message: "Home visit not found" });
    return res.json({ success: true, data: visit });
  } catch (err) {
    next(err);
  }
}

module.exports = { myHomeVisits, create, list, getOne, update, complete, cancel, noShow };
