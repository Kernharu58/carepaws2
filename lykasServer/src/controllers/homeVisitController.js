const HomeVisit = require("../models/HomeVisit");
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
    const visit = await HomeVisit.create(req.body);
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
    const visit = await HomeVisit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!visit) return res.status(404).json({ success: false, message: "Home visit not found" });
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
