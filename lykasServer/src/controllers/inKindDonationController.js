const InKindDonation = require("../models/InKindDonation");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");
const { writeAuditLog } = require("../utils/auditLogger");

async function create(req, res, next) {
  try {
    const donation = await InKindDonation.create({ ...req.body, donatedBy: req.user._id });
    return res.status(201).json({ success: true, data: donation });
  } catch (err) {
    next(err);
  }
}

async function myDonations(req, res, next) {
  try {
    const data = await InKindDonation.find({ donatedBy: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const filter = buildListQuery(req.query, { filterFields: ["status", "dropOff"], allowIncludeDeleted: true });
    const sort = buildSort(req.query);
    const total = await InKindDonation.countDocuments(filter);
    const { page, limit, skip, ...paginationRest } = buildPagination(total, req.query.page, req.query.limit);
    const data = await InKindDonation.find(filter).populate("donatedBy", "displayName email").sort(sort).skip(skip).limit(limit);
    return res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const donation = await InKindDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, message: "Donation not found" });

    donation.status = req.body.status;
    donation.staffNote = req.body.staffNote;
    if (req.body.status === "received") donation.receivedAt = new Date();
    await donation.save();

    await writeAuditLog({ actor: req.user._id, action: "inkind_donation.status_update", entityType: "InKindDonation", entityId: donation._id, req });

    return res.json({ success: true, data: donation });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const donation = await InKindDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, message: "Donation not found" });

    donation.isDeleted = true;
    donation.deletedAt = new Date();
    donation.deletedBy = req.user._id;
    await donation.save();

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function restore(req, res, next) {
  try {
    const donation = await InKindDonation.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { isDeleted: false, deletedAt: null, deletedBy: null },
      { new: true }
    );
    if (!donation) return res.status(404).json({ success: false, message: "Deleted donation not found" });
    return res.json({ success: true, data: donation });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, myDonations, list, updateStatus, remove, restore };
