const mongoose = require("mongoose");
const { IDENTITY_POLICY_VALUES, DEFAULT_IDENTITY_POLICY } = require("../config/identity");

// Shelter-level singleton — extend as needed.
const settingsSchema = new mongoose.Schema(
  {
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    // When identity (government ID) verification is required for applications:
    //   before_submission - applicant must be verified to submit (default)
    //   before_review     - may submit, but cannot advance past "submitted"
    //   none              - shelter has chosen not to require it
    // Changed only through PUT /api/settings/identity-policy (admin, audited).
    identityPolicy: {
      adoption: { type: String, enum: IDENTITY_POLICY_VALUES, default: DEFAULT_IDENTITY_POLICY.adoption },
      foster: { type: String, enum: IDENTITY_POLICY_VALUES, default: DEFAULT_IDENTITY_POLICY.foster },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
