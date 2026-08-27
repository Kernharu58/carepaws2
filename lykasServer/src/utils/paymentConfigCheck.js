// PAYMONGO_SECRET_KEY lets the app START a payment: create-checkout,
// cancel, and refund in paymentController.js each check it per-request
// and return 503 gracefully if it's missing, so an unconfigured key
// degrades that one request, not the server.
//
// PAYMONGO_WEBHOOK_SECRET is what lets a payment ever be CONFIRMED:
// webhook() rejects every incoming event with a hard 500 when it's
// unset, and the webhook is the only code path in this app that ever
// sets a payment's status to "paid" (see PM report / SETUP.md >
// PayMongo). So a deployment with the secret key set but not the
// webhook secret can accept a donor's money and never record it as
// paid — nothing else in the app will ever correct that.
//
// This is deliberately a one-time, non-fatal boot warning rather than a
// hard failure like config/redis.js's missing-REDIS_URL check: Redis
// backs rate limiting for the whole API, so every route degrades
// without it. A missing webhook secret only breaks payment
// confirmation specifically — refusing to boot the entire server (pets,
// applications, interviews, chat, everything) over a donation-specific
// config gap would be a disproportionate blast radius.
function checkPaymentConfig(env = process.env) {
  if (env.PAYMONGO_SECRET_KEY && !env.PAYMONGO_WEBHOOK_SECRET) {
    return (
      "PAYMONGO_SECRET_KEY is set but PAYMONGO_WEBHOOK_SECRET is not. " +
      "Payments can be started but will never be confirmed as paid — " +
      "every PayMongo webhook delivery will be rejected with 500. " +
      "See SETUP.md > PayMongo."
    );
  }
  return null;
}

module.exports = { checkPaymentConfig };
