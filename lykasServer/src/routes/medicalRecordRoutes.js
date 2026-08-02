const express = require("express");
const router = express.Router();

const c = require("../controllers/medicalRecordController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/summary/:petId", protect, c.summary);

router.post("/vaccinations", protect, adminOnly, c.createVaccination);
router.get("/vaccinations/upcoming", protect, adminOnly, c.upcomingVaccinations);
router.get("/vaccinations/:petId", protect, c.listVaccinations);
router.put("/vaccinations/:id", protect, adminOnly, c.updateVaccination);
router.delete("/vaccinations/:id", protect, adminOnly, c.deleteVaccination);

router.post("/vet-visits", protect, adminOnly, c.createVetVisit);
router.get("/vet-visits/:petId", protect, c.listVetVisits);
router.put("/vet-visits/:id", protect, adminOnly, c.updateVetVisit);
router.delete("/vet-visits/:id", protect, adminOnly, c.deleteVetVisit);

router.post("/records", protect, adminOnly, c.createRecord);
router.get("/records/:petId", protect, c.listRecords);
router.put("/records/:id", protect, adminOnly, c.updateRecord);
router.delete("/records/:id", protect, adminOnly, c.deleteRecord);

module.exports = router;
