const Application = require("../models/Application");
const Pet = require("../models/Pet");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");
const { writeAuditLog } = require("../utils/auditLogger");

const SEARCH_FIELDS = ["address", "experience"];
const FILTER_FIELDS = ["status", "stage", "type", "pet", "applicant"];

// GET /api/applications/my
async function myApplications(req, res, next) {
  try {
    const applications = await Application.find({ applicant: req.user._id }).populate("pet").sort({ createdAt: -1 });
    return res.json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
}

// GET /api/applications — staff
async function listApplications(req, res, next) {
  try {
    const filter = buildListQuery(req.query, { searchFields: SEARCH_FIELDS, filterFields: FILTER_FIELDS, allowIncludeDeleted: false });
    const sort = buildSort(req.query);
    const total = await Application.countDocuments(filter);
    const { page, limit, skip, ...paginationRest } = buildPagination(total, req.query.page, req.query.limit);

    const data = await Application.find(filter).populate("pet applicant").sort(sort).skip(skip).limit(limit);

    return res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
}

// GET /api/applications/:id
async function getApplication(req, res, next) {
  try {
    const application = await Application.findById(req.params.id).populate("pet applicant reviewedBy");
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });

    const isOwner = application.applicant._id.toString() === req.user._id.toString();
    const isStaff = ["staff", "admin", "super_admin"].includes(req.user.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: "Not authorized to view this application" });
    }

    const result = application.toObject();
    if (!isStaff) delete result.internalNotes; // internal notes are hidden from the applicant

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/applications
async function createApplication(req, res, next) {
  try {
    const pet = await Pet.findOne({ _id: req.body.pet, isDeleted: { $ne: true } });
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });
    if (pet.status !== "Available") {
      return res.status(409).json({ success: false, message: "This pet is not currently available" });
    }

    const activeApplication = await Application.findOne({
      pet: pet._id,
      status: { $in: ["pending", "approved"] },
    }).select("_id applicant status");
    if (activeApplication) {
      return res.status(409).json({ success: false, message: "This pet already has an active adoption application" });
    }

    const application = await Application.create({
      ...req.body,
      applicant: req.user._id,
      stageHistory: [{ stage: "submitted", changedBy: req.user._id, note: "Application submitted" }],
    });

    pet.status = "Pending";
    await pet.save();

    return res.status(201).json({ success: true, data: application });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.pet) {
      return res.status(409).json({ success: false, message: "This pet already has an active adoption application" });
    }
    next(err);
  }
}

// PUT /api/applications/:id/status — staff
async function updateStatus(req, res, next) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });

    const previousValues = { status: application.status };
    const nextStatus = req.body.status;
    if (application.status === "approved" && nextStatus !== "approved") {
      return res.status(409).json({ success: false, message: "An approved application cannot be reopened or rejected" });
    }
    if (application.status === "rejected" && nextStatus !== "rejected") {
      return res.status(409).json({ success: false, message: "A rejected application cannot be reopened" });
    }
    application.status = nextStatus;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();

    // Keep the application pipeline and pet lifecycle synchronized. The
    // status endpoint is the final decision point, so an approval/rejection
    // must never leave the mobile application's stage indicator or the pet
    // catalog in a contradictory state.
    const nextStage = nextStatus === "approved" ? "approved" : nextStatus === "rejected" ? "rejected" : application.stage;
    if (nextStage !== application.stage) {
      application.stage = nextStage;
      application.stageHistory.push({
        stage: nextStage,
        changedBy: req.user._id,
        note: req.body.note || `Application ${nextStatus}`,
      });
    }

    await application.save();

    if (nextStatus === "approved") {
      await Pet.findByIdAndUpdate(application.pet, { status: application.type === "foster" ? "Foster" : "Adopted", owner: application.applicant });
    } else if (nextStatus === "rejected") {
      await Pet.findByIdAndUpdate(application.pet, { status: "Available", owner: null });
    } else if (nextStatus === "pending") {
      await Pet.findByIdAndUpdate(application.pet, { status: "Pending", owner: null });
    }

    await writeAuditLog({
      actor: req.user._id,
      action: "application.status_update",
      entityType: "Application",
      entityId: application._id,
      previousValues,
      newValues: { status: application.status },
      req,
    });

    return res.json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

// PUT /api/applications/:id/stage — staff, moves the pipeline stage tracker
async function updateStage(req, res, next) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });

    const previousStage = application.stage;
    const nextStage = req.body.stage;
    if (application.status === "rejected" && nextStage !== "rejected") {
      return res.status(409).json({ success: false, message: "A rejected application cannot re-enter the adoption pipeline" });
    }
    if (application.status === "approved" && nextStage === "rejected") {
      return res.status(409).json({ success: false, message: "An approved application cannot be rejected" });
    }
    application.stage = nextStage;

    // Completing/approving the pipeline is also a business-state transition.
    // Keep the application status and pet status synchronized with the stage.
    if (nextStage === "approved" || nextStage === "adoption_scheduled" || nextStage === "completed") {
      application.status = "approved";
      await Pet.findByIdAndUpdate(application.pet, { status: application.type === "foster" ? "Foster" : "Adopted", owner: application.applicant });
    } else if (nextStage === "rejected") {
      application.status = "rejected";
      await Pet.findByIdAndUpdate(application.pet, { status: "Available", owner: null });
    }

    if (previousStage !== nextStage) {
      application.stageHistory.push({ stage: nextStage, changedBy: req.user._id, note: req.body.note });
    }
    await application.save();

    await writeAuditLog({
      actor: req.user._id,
      action: "application.stage_update",
      entityType: "Application",
      entityId: application._id,
      previousValues: { stage: previousStage },
      newValues: { stage: application.stage },
      req,
    });

    return res.json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

// GET /api/applications/:id/notes — staff
async function getNotes(req, res, next) {
  try {
    const application = await Application.findById(req.params.id).select("internalNotes").populate("internalNotes.author", "displayName");
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });
    return res.json({ success: true, data: application.internalNotes });
  } catch (err) {
    next(err);
  }
}

// POST /api/applications/:id/notes — staff
async function addNote(req, res, next) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });

    application.internalNotes.push({ author: req.user._id, text: req.body.text });
    await application.save();

    return res.status(201).json({ success: true, data: application.internalNotes });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/applications/:id — staff
async function deleteApplication(req, res, next) {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });

    await writeAuditLog({ actor: req.user._id, action: "application.delete", entityType: "Application", entityId: application._id, req });

    return res.json({ success: true, message: "Application deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  myApplications,
  listApplications,
  getApplication,
  createApplication,
  updateStatus,
  updateStage,
  getNotes,
  addNote,
  deleteApplication,
};
