const express = require("express");
const router = express.Router();

const c = require("../controllers/scheduledJobController");
const { protect, requireRole } = require("../middleware/authMiddleware");

router.get("/", protect, requireRole("admin", "super_admin"), c.list);
router.get("/:jobKey/history", protect, requireRole("admin", "super_admin"), c.history);
router.post("/:jobKey/run", protect, requireRole("super_admin"), c.run);

module.exports = router;
