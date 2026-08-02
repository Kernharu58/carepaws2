const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Extended from the source's ["donation"]-only enum per §4/§5.2 — the
    // intended UX flow (adoption fee payment) needs this.
    type: { type: String, enum: ["donation", "adoption_fee", "event_fee"], required: true },
    amount: { type: Number, required: true }, // integer, PHP centavos
    currency: { type: String, default: "PHP" },
    description: { type: String },
    refModel: { type: String, enum: ["Application", "Event", null], default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    paymongoPaymentId: { type: String },
    paymongoCheckoutUrl: { type: String },
    paymongoStatus: { type: String },
    paymentMethod: { type: String, enum: ["gcash", "card", "paymaya", "grab_pay", "dob", null], default: null },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending", index: true },
    paidAt: { type: Date, default: null },
    receiptUrl: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
