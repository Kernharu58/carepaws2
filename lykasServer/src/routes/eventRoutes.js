const express = require("express");
const router = express.Router();

const c = require("../controllers/eventController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { eventCreateSchema, eventUpdateSchema, eventAssignmentSchema } = require("../validators/event.schema");

router.get("/my-registrations", protect, c.myRegistrations);
router.post("/", protect, adminOnly, validateRequest(eventCreateSchema), c.create);
router.get("/", c.list);
router.get("/:id", c.getOne);
router.put("/:id", protect, adminOnly, validateRequest(eventUpdateSchema), c.update);
router.delete("/:id", protect, adminOnly, c.remove);
router.post("/:id/register", protect, c.register);
router.delete("/:id/register", protect, c.unregister);
router.get("/:id/registrations", protect, adminOnly, c.listRegistrations);
router.put("/:id/registrations/:userId/attend", protect, adminOnly, c.markAttended);
router.post("/:id/volunteers", protect, adminOnly, validateRequest(eventAssignmentSchema), c.assignVolunteer);
router.get("/:id/volunteers", protect, adminOnly, c.listVolunteerAssignments);
router.put("/:id/volunteers/:assignmentId", protect, adminOnly, c.updateVolunteerAssignment);

module.exports = router;
