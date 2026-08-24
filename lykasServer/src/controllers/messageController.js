const Message = require("../models/Message");
const User = require("../models/User");

// GET /api/messages/:userId — owner or staff
async function getMessageHistory(req, res, next) {
  try {
    const isStaff = ["staff", "admin", "super_admin"].includes(req.user.role);
    const isOwner = req.user._id.toString() === req.params.userId;

    if (!isStaff && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorized to view this conversation" });
    }

    const messages = await Message.find({ userId: req.params.userId }).sort({ createdAt: 1 });
    return res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

// GET /api/chat-sessions — staff only, every user ordered by most-recent-message-first
async function listChatSessions(req, res, next) {
  try {
    const sessions = await Message.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$userId", lastMessage: { $first: "$$ROOT" }, unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ["$isRead", false] }, { $eq: ["$sender", "user"] }] }, 1, 0] } } } },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    const userIds = sessions.map((s) => s._id);
    const users = await User.find({ _id: { $in: userIds } }).select("displayName email profilePicture");
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const data = sessions.map((s) => ({
      user: userMap.get(s._id.toString()) || null,
      lastMessage: s.lastMessage,
      unreadCount: s.unreadCount || 0,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function markConversationRead(req, res, next) {
  try {
    const isStaff = ["staff", "admin", "super_admin"].includes(req.user.role);
    const isOwner = req.user._id.toString() === req.params.userId;
    if (!isStaff && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorized to update this conversation" });
    }

    const senderToMark = isStaff ? "user" : { $in: ["admin", "shelter"] };
    await Message.updateMany(
      { userId: req.params.userId, sender: senderToMark, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMessageHistory, listChatSessions, markConversationRead };
