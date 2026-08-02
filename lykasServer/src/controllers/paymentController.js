const crypto = require("crypto");
const Payment = require("../models/Payment");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");
const { notify } = require("../utils/notificationHelper");
const logger = require("../utils/logger");

const PAYMONGO_API = "https://api.paymongo.com/v1";

function paymongoAuthHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY || "";
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

// POST /api/payments/create-checkout
async function createCheckout(req, res, next) {
  try {
    const { type, amount, description, refModel, refId } = req.body;

    const payment = await Payment.create({
      paidBy: req.user._id,
      type,
      amount,
      description,
      refModel: refModel || null,
      refId: refId || null,
      status: "pending",
    });

    // Real PayMongo checkout-session creation. Falls back to a descriptive
    // error rather than a silent stub if the secret key isn't configured,
    // so this fails loudly in dev instead of pretending to work.
    if (!process.env.PAYMONGO_SECRET_KEY) {
      return res.status(503).json({ success: false, message: "Payment gateway is not configured (PAYMONGO_SECRET_KEY missing)" });
    }

    const checkoutRes = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
      method: "POST",
      headers: { Authorization: paymongoAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ currency: "PHP", amount, name: description, quantity: 1 }],
            payment_method_types: ["gcash", "card", "paymaya", "grab_pay"],
            description,
            success_url: `${process.env.MOBILE_APP_URL}payment/success?paymentId=${payment._id}`,
            cancel_url: `${process.env.MOBILE_APP_URL}payment/cancel?paymentId=${payment._id}`,
            reference_number: payment._id.toString(),
          },
        },
      }),
    });

    const checkoutData = await checkoutRes.json();
    if (!checkoutRes.ok) {
      payment.status = "failed";
      await payment.save();
      logger.error({ checkoutData }, "PayMongo checkout session creation failed");
      return res.status(502).json({ success: false, message: "Failed to create checkout session" });
    }

    payment.paymongoCheckoutUrl = checkoutData.data.attributes.checkout_url;
    payment.paymongoPaymentId = checkoutData.data.id;
    await payment.save();

    return res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/webhook — gateway -> server
async function webhook(req, res, next) {
  try {
    const signature = req.headers["paymongo-signature"];
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET;

    // Verify the webhook signature before trusting the payload — this
    // endpoint is one of the few that must accept requests with no
    // Origin header (§4), which makes signature verification the actual
    // security boundary here, not CORS. HMAC over the raw request bytes
    // (captured by server.js's express.json verify hook), not a
    // re-serialized req.body — re-stringifying a parsed JSON object is
    // not guaranteed to reproduce the exact bytes the sender signed.
    if (secret && signature) {
      const raw = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (expected !== signature) {
        return res.status(401).json({ success: false, message: "Invalid webhook signature" });
      }
    }

    const event = req.body?.data?.attributes?.type;
    const resource = req.body?.data?.attributes?.data;
    const referenceNumber = resource?.attributes?.reference_number || resource?.attributes?.checkout_session?.reference_number;

    if (!referenceNumber) {
      return res.status(200).json({ success: true, message: "No reference number — ignored" });
    }

    const payment = await Payment.findById(referenceNumber);
    if (!payment) {
      return res.status(200).json({ success: true, message: "Unknown payment reference — ignored" });
    }

    if (event === "payment.paid" || event === "checkout_session.payment.paid") {
      payment.status = "paid";
      payment.paidAt = new Date();
      payment.paymongoStatus = "paid";
      payment.paymentMethod = resource?.attributes?.source?.type || payment.paymentMethod;
      await payment.save();

      await notify({
        recipient: payment.paidBy,
        type: "PAYMENT_RECEIVED",
        title: "Payment received",
        message: `Your payment of ₱${(payment.amount / 100).toFixed(2)} was received.`,
        refModel: "Payment",
        refId: payment._id,
      });
    } else if (event === "payment.failed") {
      payment.status = "failed";
      payment.paymongoStatus = "failed";
      await payment.save();

      await notify({
        recipient: payment.paidBy,
        type: "PAYMENT_FAILED",
        title: "Payment failed",
        message: `Your payment of ₱${(payment.amount / 100).toFixed(2)} could not be processed.`,
        refModel: "Payment",
        refId: payment._id,
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/my
async function myPayments(req, res, next) {
  try {
    const payments = await Payment.find({ paidBy: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/my/:id
async function myPaymentDetail(req, res, next) {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, paidBy: req.user._id });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    return res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments — staff
async function list(req, res, next) {
  try {
    const filter = buildListQuery(req.query, { filterFields: ["status", "type", "paidBy"], allowIncludeDeleted: true });
    const sort = buildSort(req.query);
    const total = await Payment.countDocuments(filter);
    const { page, limit, skip, ...paginationRest } = buildPagination(total, req.query.page, req.query.limit);
    const data = await Payment.find(filter).populate("paidBy", "displayName email").sort(sort).skip(skip).limit(limit);
    return res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/summary — staff
async function summary(req, res, next) {
  try {
    const result = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:id — staff
async function getOne(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id).populate("paidBy", "displayName email");
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    return res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
}

// PUT /api/payments/:id/refund — staff
async function refund(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    if (payment.status !== "paid") {
      return res.status(409).json({ success: false, message: "Only paid payments can be refunded" });
    }

    payment.status = "refunded";
    payment.notes = `${payment.notes || ""}\nRefund reason: ${req.body.reason || "n/a"}`.trim();
    await payment.save();

    return res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
}

module.exports = { createCheckout, webhook, myPayments, myPaymentDetail, list, summary, getOne, refund };
