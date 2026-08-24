const Volunteer = require("../models/Volunteer");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");
const { writeAuditLog } = require("../utils/auditLogger");

const SEARCH_FIELDS = ["motivation", "address"];
const FILTER_FIELDS = ["status"];

// POST /api/volunteers/register
async function register(req, res, next) {
  try {
    const existing = await Volunteer.findOne({ user: req.user._id, isDeleted: { $ne: true } });
    if (existing) {
      return res.status(409).json({ success: false, message: "You already have a volunteer application on file" });
    }

    const volunteer = await Volunteer.create({ ...req.body, user: req.user._id });
    return res.status(201).json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
}

// GET /api/volunteers/me
async function myProfile(req, res, next) {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id, isDeleted: { $ne: true } });
    if (!volunteer) return res.status(404).json({ success: false, message: "No volunteer profile found" });
    return res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
}

// PUT /api/volunteers/me
async function updateMyProfile(req, res, next) {
  try {
    const volunteer = await Volunteer.findOneAndUpdate(
      { user: req.user._id, isDeleted: { $ne: true } },
      { $set: req.body },
      { new: true }
    );
    if (!volunteer) return res.status(404).json({ success: false, message: "No volunteer profile found" });
    return res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
}

// GET /api/volunteers — staff
async function list(req, res, next) {
  try {
    const filter = buildListQuery(req.query, { searchFields: SEARCH_FIELDS, filterFields: FILTER_FIELDS, allowIncludeDeleted: true });
    const sort = buildSort(req.query);
    const total = await Volunteer.countDocuments(filter);
    const { page, limit, skip, ...paginationRest } = buildPagination(total, req.query.page, req.query.limit);
    const data = await Volunteer.find(filter).populate("user", "displayName email").sort(sort).skip(skip).limit(limit);
    return res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
}

// GET /api/volunteers/:id
async function getOne(req, res, next) {
  try {
    const volunteer = await Volunteer.findById(req.params.id).populate("user", "displayName email");
    if (!volunteer) return res.status(404).json({ success: false, message: "Volunteer not found" });
    return res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
}

// PUT /api/volunteers/:id/status — staff
async function updateStatus(req, res, next) {
  try {
    const volunteer = await Volunteer.findById(req.params.id);
    if (!volunteer) return res.status(404).json({ success: false, message: "Volunteer not found" });

    const previousValues = { status: volunteer.status };
    volunteer.status = req.body.status;
    if (req.body.notes !== undefined) volunteer.notes = req.body.notes;
    volunteer.reviewedBy = req.user._id;
    volunteer.reviewedAt = new Date();
    await volunteer.save();

    await writeAuditLog({
      actor: req.user._id,
      action: "volunteer.status_update",
      entityType: "Volunteer",
      entityId: volunteer._id,
      previousValues,
      newValues: { status: volunteer.status, ...(req.body.notes !== undefined ? { notes: volunteer.notes } : {}) },
      req,
    });

    return res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
}

// POST /api/volunteers/:id/hours — staff
async function logHours(req, res, next) {
  try {
    const volunteer = await Volunteer.findById(req.params.id);
    if (!volunteer) return res.status(404).json({ success: false, message: "Volunteer not found" });

    volunteer.totalHours += req.body.hours;
    await volunteer.save();

    return res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/volunteers/:id — soft delete
async function remove(req, res, next) {
  try {
    const volunteer = await Volunteer.findById(req.params.id);
    if (!volunteer) return res.status(404).json({ success: false, message: "Volunteer not found" });

    volunteer.isDeleted = true;
    volunteer.deletedAt = new Date();
    volunteer.deletedBy = req.user._id;
    await volunteer.save();

    await writeAuditLog({ actor: req.user._id, action: "volunteer.delete", entityType: "Volunteer", entityId: volunteer._id, req });

    return res.json({ success: true, message: "Volunteer archived" });
  } catch (err) {
    next(err);
  }
}

// POST /api/volunteers/:id/restore
async function restore(req, res, next) {
  try {
    const volunteer = await Volunteer.findOne({ _id: req.params.id, isDeleted: true });
    if (!volunteer) return res.status(404).json({ success: false, message: "Deleted volunteer not found" });

    volunteer.isDeleted = false;
    volunteer.deletedAt = null;
    volunteer.deletedBy = null;
    await volunteer.save();

    return res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, myProfile, updateMyProfile, list, getOne, updateStatus, logHours, remove, restore };
