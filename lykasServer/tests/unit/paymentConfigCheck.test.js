const { checkPaymentConfig } = require("../../src/utils/paymentConfigCheck");

// Regression coverage for the donation-module root cause: SETUP.md used to
// describe PAYMONGO_WEBHOOK_SECRET as an optional extra, and it was missing
// from .env.example entirely. In reality paymentController.js's webhook()
// rejects every event with 500 when it's unset, and the webhook is the only
// code path in the app that ever sets a payment's status to "paid" — so a
// deployment with the secret key but no webhook secret can charge a donor
// successfully through PayMongo and never record the donation as paid.
describe("checkPaymentConfig", () => {
  it("warns when PAYMONGO_SECRET_KEY is set but PAYMONGO_WEBHOOK_SECRET is not", () => {
    const warning = checkPaymentConfig({ PAYMONGO_SECRET_KEY: "sk_test_x" });
    expect(warning).toMatch(/PAYMONGO_WEBHOOK_SECRET/);
    expect(warning).toMatch(/never be confirmed as paid/);
  });

  it("does not warn when both payment secrets are configured", () => {
    expect(
      checkPaymentConfig({ PAYMONGO_SECRET_KEY: "sk_test_x", PAYMONGO_WEBHOOK_SECRET: "whsk_x" })
    ).toBeNull();
  });

  it("does not warn when payments are not configured at all (nothing to confirm)", () => {
    expect(checkPaymentConfig({})).toBeNull();
  });

  it("does not warn when only the webhook secret is set without a checkout key", () => {
    // Unusual, but not the failure mode this check exists for — there's no
    // PAYMONGO_SECRET_KEY to start a checkout with in the first place.
    expect(checkPaymentConfig({ PAYMONGO_WEBHOOK_SECRET: "whsk_x" })).toBeNull();
  });
});
