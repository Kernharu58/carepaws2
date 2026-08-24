const RiskAssessment = require("../models/RiskAssessment");
const Application = require("../models/Application");
const { notifyOnce } = require("../utils/notificationHelper");

// GET /api/risk-assessments/application/:applicationId
async function byApplication(req, res, next) {
  try {
    const assessment = await RiskAssessment.findOne({ application: req.params.applicationId });
    if (!assessment) return res.status(404).json({ success: false, message: "No risk assessment for this application" });
    return res.json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
}

// POST /api/risk-assessments — staff
// totalScore/riskLevel are ALWAYS computed server-side by the model's
// pre-save hook — never accepted from the client (§5.2).
async function create(req, res, next) {
  try {
    const application = await Application.findById(req.body.application).select("applicant pet status type");
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });
    if (application.status === "rejected") return res.status(409).json({ success: false, message: "Cannot assess a rejected application" });
    if (application.stage !== "risk_assessment") {
      return res.status(409).json({ success: false, message: "Application must reach the risk assessment stage before it can be assessed" });
    }

    const existing = await RiskAssessment.findOne({ application: application._id });
    if (existing) return res.status(409).json({ success: false, message: "A risk assessment already exists for this application" });

    const assessment = await RiskAssessment.create({
      ...req.body,
      applicant: application.applicant,
      pet: application.pet,
      assessedBy: req.user._id,
    });
    await notifyOnce({
      recipient: application.applicant,
      sender: req.user._id,
      type: "RISK_ASSESSMENT_COMPLETED",
      title: "Risk assessment completed",
      message: "Your application risk assessment has been completed by staff.",
      refModel: "Application",
      refId: application._id,
      dedupeKey: `risk-assessment-completed:${application._id}`,
    });
    return res.status(201).json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
}

// GET /api/risk-assessments — staff
async function list(req, res, next) {
  try {
    const assessments = await RiskAssessment.find().populate("application pet applicant assessedBy").sort({ createdAt: -1 });
    return res.json({ success: true, data: assessments });
  } catch (err) {
    next(err);
  }
}

// GET /api/risk-assessments/:id
async function getOne(req, res, next) {
  try {
    const assessment = await RiskAssessment.findById(req.params.id).populate("application pet applicant assessedBy");
    if (!assessment) return res.status(404).json({ success: false, message: "Risk assessment not found" });
    return res.json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
}

// PUT /api/risk-assessments/:id — staff, re-scoring triggers the pre-save hook again
async function update(req, res, next) {
  try {
    const assessment = await RiskAssessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ success: false, message: "Risk assessment not found" });

    if (req.body.application) {
      const application = await Application.findById(req.body.application).select("applicant pet status");
      if (!application) return res.status(404).json({ success: false, message: "Application not found" });
      assessment.application = application._id;
      assessment.applicant = application.applicant;
      assessment.pet = application.pet;
    }
    if (req.body.scores) assessment.scores = { ...assessment.scores.toObject(), ...req.body.scores };
    if (req.body.notes !== undefined) assessment.notes = req.body.notes;
    if (req.body.redFlags !== undefined) assessment.redFlags = req.body.redFlags;
    if (req.body.recommendation !== undefined) assessment.recommendation = req.body.recommendation;

    await assessment.save(); // re-runs the scoring pre-save hook

    return res.json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
}

module.exports = { byApplication, create, list, getOne, update };
