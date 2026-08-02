const express = require("express");
const router = express.Router();

const c = require("../controllers/inKindDonationController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.post("/", protect, c.create);
router.get("/my", protect, c.myDonations);
router.get("/", protect, adminOnly, c.list);
router.patch("/:id/status", protect, adminOnly, c.updateStatus);
router.delete("/:id", protect, adminOnly, c.remove);
router.post("/:id/restore", protect, adminOnly, c.restore);

module.exports = router;
