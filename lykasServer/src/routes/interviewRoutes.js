const express = require("express");
const router = express.Router();

const c = require("../controllers/interviewController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/my", protect, c.myInterviews);
router.post("/", protect, adminOnly, c.create);
router.get("/", protect, adminOnly, c.list);
router.get("/:id", protect, c.getOne);
router.put("/:id", protect, adminOnly, c.update);
router.put("/:id/complete", protect, adminOnly, c.complete);
router.put("/:id/cancel", protect, adminOnly, c.cancel);
router.put("/:id/no-show", protect, adminOnly, c.noShow);

module.exports = router;
