const express = require("express");
const router = express.Router();

const c = require("../controllers/identityController");
const { protect, adminOnly, requireRole } = require("../middleware/authMiddleware");
const { uploadDocument } = require("../middleware/uploadMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { identityUploadSchema, identityReviewSchema, identityQueueQuerySchema } = require("../validators/identity.schema");

// Applicant (own record only; the owner is always req.user, never a client-supplied id)
router.get("/me", protect, c.me);
router.get("/policy", protect, c.policy);
router.post("/documents", protect, uploadDocument.single("file"), validateRequest(identityUploadSchema), c.uploadMine);
router.delete("/documents/:id", protect, c.withdraw);

// Staff-assisted walk-in upload (staff, admin, super_admin). A DIFFERENT reviewer must decide.
router.post("/walk-in/:userId/documents", protect, adminOnly, uploadDocument.single("file"), validateRequest(identityUploadSchema), c.uploadForApplicant);
router.get("/users/:userId", protect, adminOnly, c.userSummary);

// Reviewers only (admin, super_admin). The service re-checks the role.
const reviewer = requireRole("admin");
router.get("/queue", protect, reviewer, validateRequest(identityQueueQuerySchema, "query"), c.queue);
router.get("/documents/:id", protect, reviewer, c.detail);
router.post("/documents/:id/review", protect, reviewer, validateRequest(identityReviewSchema), c.review);
router.post("/users/:userId/reconcile", protect, reviewer, c.reconcile);

// Owner or reviewer; authorisation decided in the service.
router.get("/documents/:id/file", protect, c.file);

module.exports = router;
