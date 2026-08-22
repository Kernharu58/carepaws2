const express = require("express");
const router = express.Router();

const riskAssessmentController = require("../controllers/riskAssessmentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { riskAssessmentCreateSchema, riskAssessmentUpdateSchema } = require("../validators/riskAssessment.schema");

router.get("/application/:applicationId", protect, adminOnly, riskAssessmentController.byApplication);
router.post("/", protect, adminOnly, validateRequest(riskAssessmentCreateSchema), riskAssessmentController.create);
router.get("/", protect, adminOnly, riskAssessmentController.list);
router.get("/:id", protect, adminOnly, riskAssessmentController.getOne);
router.put("/:id", protect, adminOnly, validateRequest(riskAssessmentUpdateSchema), riskAssessmentController.update);

module.exports = router;
