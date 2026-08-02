const request = require("supertest");
const crypto = require("crypto");

jest.mock("../../src/middleware/rateLimitMiddleware", () => ({
  globalLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  passwordResetLimiter: (req, res, next) => next(),
  webhookLimiter: (req, res, next) => next(),
}));

const { app } = require("../../src/server");
const User = require("../../src/models/User");
const Payment = require("../../src/models/Payment");

function paymongoPayload({ referenceNumber, eventType = "payment.paid", sourceType = "gcash" }) {
  return {
    data: {
      attributes: {
        type: eventType,
        data: {
          attributes: {
            reference_number: referenceNumber,
            source: { type: sourceType },
          },
        },
      },
    },
  };
}

function signPayload(secret, payload) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

describe("Payment webhook", () => {
  let payer;

  beforeEach(async () => {
    // No pushToken on this user, so notify() won't attempt an outbound
    // Expo push call during these tests.
    payer = await User.create({ displayName: "Payer", email: "payer@example.com", password: "password123" });
  });

  it("marks a pending payment as paid on a payment.paid event, unsigned (no PAYMONGO_WEBHOOK_SECRET configured)", async () => {
    const payment = await Payment.create({
      paidBy: payer._id,
      type: "adoption_fee",
      amount: 50000,
      description: "Adoption fee",
      status: "pending",
    });

    const res = await request(app)
      .post("/api/payments/webhook")
      .send(paymongoPayload({ referenceNumber: payment._id.toString() }));

    expect(res.status).toBe(200);

    const updated = await Payment.findById(payment._id);
    expect(updated.status).toBe("paid");
    expect(updated.paidAt).toBeTruthy();
    expect(updated.paymentMethod).toBe("gcash");
  });

  it("marks a payment as failed on a payment.failed event", async () => {
    const payment = await Payment.create({
      paidBy: payer._id,
      type: "donation",
      amount: 10000,
      description: "Donation",
      status: "pending",
    });

    const res = await request(app)
      .post("/api/payments/webhook")
      .send(paymongoPayload({ referenceNumber: payment._id.toString(), eventType: "payment.failed" }));

    expect(res.status).toBe(200);
    expect((await Payment.findById(payment._id)).status).toBe("failed");
  });

  it("ignores a webhook payload with no matching payment reference, without erroring", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .send(paymongoPayload({ referenceNumber: "000000000000000000000000" }));

    expect(res.status).toBe(200);
  });

  it("rejects the webhook when a signature is required and doesn't match", async () => {
    const originalSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    process.env.PAYMONGO_WEBHOOK_SECRET = "test_webhook_secret";

    try {
      const payment = await Payment.create({
        paidBy: payer._id,
        type: "adoption_fee",
        amount: 50000,
        description: "Adoption fee",
        status: "pending",
      });

      const payload = paymongoPayload({ referenceNumber: payment._id.toString() });

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("paymongo-signature", "not-the-real-signature")
        .send(payload);

      expect(res.status).toBe(401);
      expect((await Payment.findById(payment._id)).status).toBe("pending"); // unchanged
    } finally {
      process.env.PAYMONGO_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("accepts the webhook when the signature is correctly computed", async () => {
    const originalSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    process.env.PAYMONGO_WEBHOOK_SECRET = "test_webhook_secret";

    try {
      const payment = await Payment.create({
        paidBy: payer._id,
        type: "event_fee",
        amount: 25000,
        description: "Event fee",
        status: "pending",
      });

      const payload = paymongoPayload({ referenceNumber: payment._id.toString() });
      const signature = signPayload("test_webhook_secret", payload);

      const res = await request(app).post("/api/payments/webhook").set("paymongo-signature", signature).send(payload);

      expect(res.status).toBe(200);
      expect((await Payment.findById(payment._id)).status).toBe("paid");
    } finally {
      process.env.PAYMONGO_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("refuses to create a checkout session when PAYMONGO_SECRET_KEY is not configured", async () => {
    const loginRes = await request(app)
      .post("/api/auth/register")
      .send({ displayName: "Buyer", email: "buyer@example.com", password: "password123" });

    const res = await request(app)
      .post("/api/payments/create-checkout")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`)
      .send({ type: "donation", amount: 10000, description: "Test donation" });

    // PAYMONGO_SECRET_KEY is intentionally unset in the test environment.
    expect(res.status).toBe(503);
  });
});
