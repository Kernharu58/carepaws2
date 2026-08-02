const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notificationController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { sendNotificationSchema } = require("../validators/notification.schema");

router.get("/unread-count", protect, notificationController.unreadCount);
router.get("/my", protect, notificationController.myNotifications);
router.put("/read-all", protect, notificationController.readAll);
router.delete("/", protect, notificationController.clearAll);
router.put("/:id/read", protect, notificationController.markRead);
router.delete("/:id", protect, notificationController.remove);

router.get("/admin", protect, adminOnly, notificationController.adminList);
router.post("/send", protect, adminOnly, validateRequest(sendNotificationSchema), notificationController.send);
router.get("/", protect, adminOnly, notificationController.adminList);

module.exports = router;
