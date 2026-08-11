const express = require("express");
const router = express.Router();

const c = require("../controllers/userDocumentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { uploadDocument } = require("../middleware/uploadMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { userDocumentVerifySchema } = require("../validators/userDocument.schema");

router.get("/my", protect, c.myDocuments);
router.post("/", protect, uploadDocument.single("file"), c.upload);
router.delete("/:id", protect, c.remove);
router.get("/", protect, adminOnly, c.list);
router.put("/:id/verify", protect, adminOnly, validateRequest(userDocumentVerifySchema), c.verify);

module.exports = router;
