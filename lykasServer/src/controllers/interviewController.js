const Interview = require("../models/Interview");
const { notify } = require("../utils/notificationHelper");

async function myInterviews(req, res, next) {
  try {
    const data = await Interview.find({ applicant: req.user._id }).populate("pet").sort({ scheduledDate: 1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const interview = await Interview.create(req.body);
    await notify({
      recipient: interview.applicant,
      type: "INTERVIEW_SCHEDULED",
      title: "Interview scheduled",
      message: `Your adoption interview is scheduled for ${new Date(interview.scheduledDate).toLocaleString()}.`,
      refModel: "Interview",
      refId: interview._id,
    });
    return res.status(201).json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const data = await Interview.find().populate("applicant pet conductedBy").sort({ scheduledDate: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.id).populate("applicant pet conductedBy application");
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
    return res.json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const interview = await Interview.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
    await notify({
      recipient: interview.applicant,
      type: "INTERVIEW_RESCHEDULED",
      title: "Interview rescheduled",
      message: `Your interview has been updated to ${new Date(interview.scheduledDate).toLocaleString()}.`,
      refModel: "Interview",
      refId: interview._id,
    });
    return res.json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

async function complete(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });

    interview.status = "completed";
    interview.result = req.body.result;
    interview.notes = req.body.notes;
    interview.completedAt = new Date();
    await interview.save();

    await notify({
      recipient: interview.applicant,
      type: "INTERVIEW_RESULT",
      title: "Interview result available",
      message: `Your interview result: ${interview.result}.`,
      refModel: "Interview",
      refId: interview._id,
    });

    return res.json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });

    interview.status = "cancelled";
    interview.cancelReason = req.body.cancelReason;
    await interview.save();

    await notify({
      recipient: interview.applicant,
      type: "INTERVIEW_CANCELLED",
      title: "Interview cancelled",
      message: interview.cancelReason || "Your interview has been cancelled.",
      refModel: "Interview",
      refId: interview._id,
    });

    return res.json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

async function noShow(req, res, next) {
  try {
    const interview = await Interview.findByIdAndUpdate(req.params.id, { status: "no-show" }, { new: true });
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
    return res.json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

module.exports = { myInterviews, create, list, getOne, update, complete, cancel, noShow };
