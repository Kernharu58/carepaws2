const express = require("express");
const router = express.Router();

const messageController = require("../controllers/messageController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/:userId", protect, messageController.getMessageHistory);

module.exports = router;

// Exported separately since /api/chat-sessions is a distinct mount path (§5.3)
module.exports.chatSessionsRouter = (() => {
  const r = express.Router();
  r.get("/", protect, adminOnly, messageController.listChatSessions);
  return r;
})();
