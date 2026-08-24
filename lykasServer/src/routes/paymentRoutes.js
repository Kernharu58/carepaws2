const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { createCheckoutSchema, refundSchema } = require("../validators/payment.schema");
const { webhookLimiter } = require("../middleware/rateLimitMiddleware");

// Webhook has no auth — it's the gateway calling us, verified by signature
// inside the controller, not by JWT (§4 — the no-Origin-header CORS
// allowance is intentional for exactly this endpoint). Rate-limited on
// its own bucket per §11.6.8.
router.post("/webhook", webhookLimiter, paymentController.webhook);

router.post("/create-checkout", protect, validateRequest(createCheckoutSchema), paymentController.createCheckout);
router.get("/my", protect, paymentController.myPayments);
router.get("/my/:id", protect, paymentController.myPaymentDetail);
router.post("/:id/cancel", protect, paymentController.cancel);
router.get("/summary", protect, adminOnly, paymentController.summary);
router.get("/", protect, adminOnly, paymentController.list);
router.get("/:id/receipt", protect, paymentController.receipt);
router.get("/:id", protect, adminOnly, paymentController.getOne);
router.put("/:id/refund", protect, adminOnly, validateRequest(refundSchema), paymentController.refund);

module.exports = router;
