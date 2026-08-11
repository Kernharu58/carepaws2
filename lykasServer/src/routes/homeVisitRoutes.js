const express = require("express");
const router = express.Router();

const c = require("../controllers/homeVisitController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  homeVisitCreateSchema,
  homeVisitUpdateSchema,
  homeVisitCompleteSchema,
  homeVisitCancelSchema,
} = require("../validators/homeVisit.schema");

router.get("/my", protect, c.myHomeVisits);
router.post("/", protect, adminOnly, validateRequest(homeVisitCreateSchema), c.create);
router.get("/", protect, adminOnly, c.list);
router.get("/:id", protect, c.getOne);
router.put("/:id", protect, adminOnly, validateRequest(homeVisitUpdateSchema), c.update);
router.put("/:id/complete", protect, adminOnly, validateRequest(homeVisitCompleteSchema), c.complete);
router.put("/:id/cancel", protect, adminOnly, validateRequest(homeVisitCancelSchema), c.cancel);
router.put("/:id/no-show", protect, adminOnly, c.noShow);

module.exports = router;
