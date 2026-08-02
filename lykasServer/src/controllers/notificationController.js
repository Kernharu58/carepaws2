const Notification = require("../models/Notification");
const { notify } = require("../utils/notificationHelper");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");

// GET /api/notifications/unread-count
async function unreadCount(req, res, next) {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    return res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/my
async function myNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/read-all
async function readAll(req, res, next) {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notifications — clear all of the current user's notifications
async function clearAll(req, res, next) {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notifications/:id
async function remove(req, res, next) {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/admin — staff, all notifications
async function adminList(req, res, next) {
  try {
    const filter = buildListQuery(req.query, { filterFields: ["type", "recipient", "isRead"], allowIncludeDeleted: true });
    const sort = buildSort(req.query);
    const total = await Notification.countDocuments(filter);
    const { page, limit, skip, ...paginationRest } = buildPagination(total, req.query.page, req.query.limit);
    const data = await Notification.find(filter).populate("recipient", "displayName email").sort(sort).skip(skip).limit(limit);
    return res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/send — staff, broadcast/targeted send
async function send(req, res, next) {
  try {
    const { recipientIds, type, title, message, refModel, refId } = req.body;
    const results = await Promise.all(
      recipientIds.map((recipient) =>
        notify({ recipient, sender: req.user._id, type, title, message, refModel, refId })
      )
    );
    return res.status(201).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

module.exports = { unreadCount, myNotifications, readAll, clearAll, markRead, remove, adminList, send };
