const { Foster, WeeklyFosterReport, getFosterReportDueDate } = require("../models/Foster");
const Pet = require("../models/Pet");
const Application = require("../models/Application");
const { notifyOnce } = require("../utils/notificationHelper");

// GET /api/foster/reports/pending-review — staff
async function pendingReports(req, res, next) {
  try {
    const reports = await WeeklyFosterReport.find({ status: "submitted", reviewedBy: null }).populate("foster pet fosterer").sort({ reportDate: 1 });
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
    if (report.status !== "submitted") {
      return res.status(409).json({ success: false, message: "Only submitted foster reports can be reviewed" });
    }

    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.adminNotes = req.body.adminNotes;
    await report.save();

    await notifyOnce({
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
    const application = await Application.findById(req.body.application);
    if (!application) {
      return res.status(404).json({ success: false, message: "Foster application not found" });
    }

    if (application.type !== "foster" || application.status !== "approved" || application.stage !== "approved") {
      return res.status(409).json({ success: false, message: "Foster placement requires an approved foster application" });
    }

    if (req.body.fosterer?.toString() !== application.applicant.toString() || req.body.pet?.toString() !== application.pet.toString()) {
      return res.status(409).json({ success: false, message: "Fosterer and pet must match the approved application" });
    }

    const pet = await Pet.findById(application.pet);
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });
    if (pet.status !== "Foster" || pet.owner?.toString() !== application.applicant.toString()) {
      return res.status(409).json({ success: false, message: "Pet is not in the expected approved foster state" });
    }

    const existing = await Foster.findOne({ application: application._id, status: { $in: ["active"] } });
    if (existing) {
      return res.status(409).json({ success: false, message: "A foster placement already exists for this application" });
    }

    const startDate = new Date(req.body.startDate);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid foster start date" });
    }

    let trialDurationDays = req.body.trialDurationDays;
    let expectedEndDate;

    if (trialDurationDays !== undefined) {
      if (!Number.isInteger(trialDurationDays) || trialDurationDays < 30 || trialDurationDays > 60) {
        return res.status(400).json({ success: false, message: "Foster trial duration must be between 30 and 60 days" });
      }
      expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + trialDurationDays);
    } else if (req.body.expectedEndDate) {
      expectedEndDate = new Date(req.body.expectedEndDate);
      if (Number.isNaN(expectedEndDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid foster expected end date" });
      }
      trialDurationDays = Math.round((expectedEndDate.getTime() - startDate.getTime()) / 86400000);
      if (trialDurationDays < 30 || trialDurationDays > 60) {
        return res.status(400).json({ success: false, message: "Foster trial duration must be between 30 and 60 days" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Foster trial duration or expected end date is required" });
    }

    // The trial dates are the source of truth for the number of weekly reports.
    // Ignore a client-supplied count so the monitoring workflow cannot drift
    // from the actual trial period.
    const weeklyReportsRequired = Math.ceil(trialDurationDays / 7);

    const foster = await Foster.create({
      ...req.body,
      startDate,
      expectedEndDate,
      trialDurationDays,
      weeklyReportsRequired,
      weeklyReportsSubmitted: 0,
      application: application._id,
      pet: application.pet,
      fosterer: application.applicant,
      assignedBy: req.user._id,
    });

    await notifyOnce({
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
    const foster = await Foster.findById(req.params.id);
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });

    Object.assign(foster, req.body);

    if (foster.status === "active" && (!foster.startDate || !foster.expectedEndDate || !foster.trialDurationDays)) {
      return res.status(409).json({ success: false, message: "An active foster must have a valid trial period" });
    }
    if (foster.status === "completed" && (!foster.application || !foster.startDate || !foster.endDate || !foster.trialDurationDays)) {
      return res.status(409).json({ success: false, message: "A completed foster must have a valid placement and trial period" });
    }
    if (foster.trialDurationDays !== undefined && (foster.trialDurationDays < 30 || foster.trialDurationDays > 60)) {
      return res.status(409).json({ success: false, message: "Foster trial duration must be between 30 and 60 days" });
    }

    await foster.save();
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
    if (foster.status !== "active") {
      return res.status(409).json({ success: false, message: "Only an active foster placement can be completed" });
    }
    if (!foster.application || !foster.startDate || !foster.expectedEndDate || !foster.trialDurationDays) {
      return res.status(409).json({ success: false, message: "Foster placement has no valid trial period" });
    }

    foster.status = "completed";
    foster.outcome = req.body.outcome;
    foster.returnNotes = req.body.returnNotes;
    foster.staffNotes = req.body.staffNotes;
    foster.endDate = new Date();
    foster.closedAt = new Date();
    foster.endedBy = req.user._id;
    await foster.save();

    const newPetStatus = req.body.outcome === "ADOPTED" ? "Adopted" : "Available";
    const petUpdate = { status: newPetStatus };
    if (req.body.outcome !== "ADOPTED") petUpdate.owner = null;
    await Pet.findByIdAndUpdate(foster.pet, petUpdate);

    await notifyOnce({
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
    if (foster.status !== "active") {
      return res.status(409).json({ success: false, message: "Only an active foster placement can be cancelled" });
    }

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

    const submitted = await WeeklyFosterReport.countDocuments({
      foster: foster._id,
      status: "submitted",
    });
    if (submitted !== foster.weeklyReportsSubmitted) {
      foster.weeklyReportsSubmitted = submitted;
      await foster.save();
    }

    const hasTrialPeriod = Boolean(
      foster.startDate &&
        foster.expectedEndDate &&
        foster.trialDurationDays >= 30 &&
        foster.trialDurationDays <= 60
    );
    const missingReports = Math.max(0, foster.weeklyReportsRequired - submitted);
    return res.json({
      success: true,
      data: { canFinalize: hasTrialPeriod && missingReports === 0, missingReports, hasTrialPeriod },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/foster/:fosterId/reports
async function addReport(req, res, next) {
  try {
    const foster = await Foster.findById(req.params.fosterId);
    if (!foster) return res.status(404).json({ success: false, message: "Foster not found" });
    if (foster.status !== "active") {
      return res.status(409).json({ success: false, message: "Weekly reports can only be submitted for an active foster placement" });
    }

    const weekNumber = Number(req.body.weekNumber);
    if (weekNumber > foster.weeklyReportsRequired) {
      return res.status(409).json({ success: false, message: "Report week is outside the foster trial period" });
    }

    const previousSubmitted = await WeeklyFosterReport.countDocuments({
      foster: foster._id,
      status: "submitted",
      weekNumber: { $lt: weekNumber },
    });
    if (previousSubmitted !== weekNumber - 1) {
      return res.status(409).json({
        success: false,
        message: "Weekly reports must be submitted in sequence",
      });
    }

    const dueDate = getFosterReportDueDate(foster, weekNumber);

    let report = await WeeklyFosterReport.findOne({
      foster: foster._id,
      weekNumber,
    });

    if (report?.status === "submitted") {
      return res.status(409).json({ success: false, message: "A report for this foster week already exists" });
    }

    if (report) {
      Object.assign(report, req.body);
      report.dueDate = dueDate;
      report.status = "submitted";
      report.reportDate = new Date();
      report.submittedAt = new Date();
      await report.save();
    } else {
      report = await WeeklyFosterReport.create({
        ...req.body,
        foster: foster._id,
        pet: foster.pet,
        fosterer: foster.fosterer,
        weekNumber,
        dueDate,
        status: "submitted",
        reportDate: new Date(),
        submittedAt: new Date(),
      });
    }

    foster.weeklyReportsSubmitted = await WeeklyFosterReport.countDocuments({
      foster: foster._id,
      status: "submitted",
    });
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

    const reports = await WeeklyFosterReport.find({ foster: foster._id }).select("weekNumber status dueDate");
    const byWeek = new Map(reports.map((report) => [report.weekNumber, report]));
    const missing = [];
    const overdue = [];
    const now = new Date();

    for (let week = 1; week <= foster.weeklyReportsRequired; week += 1) {
      const report = byWeek.get(week);
      const dueDate = report?.dueDate || getFosterReportDueDate(foster, week);
      if (!report || report.status !== "submitted") {
        missing.push(week);
        if (dueDate <= now) overdue.push(week);
      }
    }

    return res.json({ success: true, data: { missingWeeks: missing, overdueWeeks: overdue } });
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
