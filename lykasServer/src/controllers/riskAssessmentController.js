const RiskAssessment = require("../models/RiskAssessment");

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
    const assessment = await RiskAssessment.create({ ...req.body, assessedBy: req.user._id });
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

    if (req.body.scores) assessment.scores = { ...assessment.scores.toObject(), ...req.body.scores };
    if (req.body.notes !== undefined) assessment.notes = req.body.notes;
    if (req.body.redFlags) assessment.redFlags = req.body.redFlags;
    if (req.body.recommendation) assessment.recommendation = req.body.recommendation;

    await assessment.save(); // re-runs the scoring pre-save hook
    return res.json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
}

module.exports = { byApplication, create, list, getOne, update };
