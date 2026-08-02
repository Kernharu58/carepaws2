const { Foster, WeeklyFosterReport } = require("../models/Foster");
const Pet = require("../models/Pet");
const { notify } = require("../utils/notificationHelper");

// GET /api/foster/reports/pending-review — staff
async function pendingReports(req, res, next) {
  try {
    const reports = await WeeklyFosterReport.find({ reviewedBy: null }).populate("foster pet fosterer").sort({ reportDate: 1 });
    return res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
}

// PUT /api/foster/reports/:reportId/review — staff
async function reviewReport(req, res, next) {
  try {
    const report = await WeeklyFosterReport.findById(req.params.reportId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.adminNotes = req.body.adminNotes;
    await report.save();

    await notify({
      recipient: report.fosterer,
      type: "FOSTER_REPORT_REVIEWED",
      title: "Your weekly foster report was reviewed",
      message: `Week ${report.weekNumber} report has been reviewed by staff.`,
      refModel: "Foster",
      refId: report.foster,
    });

    return res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

// GET /api/foster/my
async function myFosters(req, res, next) {
  try {
    const fosters = await Foster.find({ fosterer: req.user._id }).populate("pet").sort({ createdAt: -1 });
    return res.json({ success: true, data: fosters });
  } catch (err) {
    next(err);
  }
}

// POST /api/foster — staff, assigns a pet to a foster
async function create(req, res, next) {
  try {
    const foster = await Foster.create({ ...req.body, assignedBy: req.user._id });
    await Pet.findByIdAndUpdate(foster.pet, { status: "Foster" });

    await notify({
      recipient: foster.fosterer,
      type: "FOSTER_STARTED",
      title: "Your foster placement has started",
      message: "You've been assigned a new foster pet. Check your foster dashboard for details.",
      refModel: "Foster",
      refId: foster._id,
    });

    return res.status(201).json({ success: true, data: foster });
  } catch (err) {
    next(err);
  }
}

// GET /api/foster — staff
async function list(req, res, next) {
  try {
    const fosters = await Foster.find().populate("pet fosterer").sort({ createdAt: -1 });
    return res.json({ success: true, data: fosters });
  } catch (err) {
    next(err);
  }
}

// GET /api/foster/:id
async function getOne(req, res, next) {
  try {
    const foster = await Foster.findById(req.params.id).populate("pet fosterer application");
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });
    return res.json({ success: true, data: foster });
  } catch (err) {
    next(err);
  }
}

// PUT /api/foster/:id — staff
async function update(req, res, next) {
  try {
    const foster = await Foster.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });
    return res.json({ success: true, data: foster });
  } catch (err) {
    next(err);
  }
}

// PUT /api/foster/:id/end — staff
async function end(req, res, next) {
  try {
    const foster = await Foster.findById(req.params.id);
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });

    foster.status = "completed";
    foster.outcome = req.body.outcome;
    foster.returnNotes = req.body.returnNotes;
    foster.staffNotes = req.body.staffNotes;
    foster.endDate = new Date();
    foster.closedAt = new Date();
    foster.endedBy = req.user._id;
    await foster.save();

    const newPetStatus = req.body.outcome === "ADOPTED" ? "Adopted" : "Available";
    await Pet.findByIdAndUpdate(foster.pet, { status: newPetStatus });

    await notify({
      recipient: foster.fosterer,
      type: "FOSTER_ENDED",
      title: "Your foster placement has ended",
      message: `Outcome: ${req.body.outcome}.`,
      refModel: "Foster",
      refId: foster._id,
    });

    return res.json({ success: true, data: foster });
  } catch (err) {
    next(err);
  }
}

// PUT /api/foster/:id/cancel — staff
async function cancel(req, res, next) {
  try {
    const foster = await Foster.findById(req.params.id);
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });

    foster.status = "cancelled";
    foster.closedAt = new Date();
    foster.endedBy = req.user._id;
    await foster.save();

    await Pet.findByIdAndUpdate(foster.pet, { status: "Available" });

    return res.json({ success: true, data: foster });
  } catch (err) {
    next(err);
  }
}

// GET /api/foster/:id/can-finalize
async function canFinalize(req, res, next) {
  try {
    const foster = await Foster.findById(req.params.id);
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });

    const missingReports = Math.max(0, foster.weeklyReportsRequired - foster.weeklyReportsSubmitted);
    return res.json({ success: true, data: { canFinalize: missingReports === 0, missingReports } });
  } catch (err) {
    next(err);
  }
}

// POST /api/foster/:fosterId/reports
async function addReport(req, res, next) {
  try {
    const foster = await Foster.findById(req.params.fosterId);
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });

    const report = await WeeklyFosterReport.create({
      ...req.body,
      foster: foster._id,
      pet: foster.pet,
      fosterer: foster.fosterer,
    });

    foster.weeklyReportsSubmitted += 1;
    await foster.save();

    return res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

// GET /api/foster/:fosterId/reports
async function listReports(req, res, next) {
  try {
    const reports = await WeeklyFosterReport.find({ foster: req.params.fosterId }).sort({ weekNumber: 1 });
    return res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
}

// GET /api/foster/:fosterId/reports/missing
async function missingReports(req, res, next) {
  try {
    const foster = await Foster.findById(req.params.fosterId);
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });

    const submitted = await WeeklyFosterReport.find({ foster: foster._id }).select("weekNumber");
    const submittedWeeks = new Set(submitted.map((r) => r.weekNumber));
    const missing = [];
    for (let w = 1; w <= foster.weeklyReportsRequired; w++) {
      if (!submittedWeeks.has(w)) missing.push(w);
    }

    return res.json({ success: true, data: { missingWeeks: missing } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  pendingReports,
  reviewReport,
  myFosters,
  create,
  list,
  getOne,
  update,
  end,
  cancel,
  canFinalize,
  addReport,
  listReports,
  missingReports,
};
