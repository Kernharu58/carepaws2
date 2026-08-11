const express = require("express");
const router = express.Router();

const c = require("../controllers/interviewController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  interviewCreateSchema,
  interviewUpdateSchema,
  interviewCompleteSchema,
  interviewCancelSchema,
} = require("../validators/interview.schema");

router.get("/my", protect, c.myInterviews);
router.post("/", protect, adminOnly, validateRequest(interviewCreateSchema), c.create);
router.get("/", protect, adminOnly, c.list);
router.get("/:id", protect, c.getOne);
router.put("/:id", protect, adminOnly, validateRequest(interviewUpdateSchema), c.update);
router.put("/:id/complete", protect, adminOnly, validateRequest(interviewCompleteSchema), c.complete);
router.put("/:id/cancel", protect, adminOnly, validateRequest(interviewCancelSchema), c.cancel);
router.put("/:id/no-show", protect, adminOnly, c.noShow);

module.exports = router;
