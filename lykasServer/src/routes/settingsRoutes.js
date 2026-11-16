const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");
const { protect, adminOnly, requireRole } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { identityPolicySchema } = require("../validators/identity.schema");
const { writeAuditLog } = require("../utils/auditLogger");

router.get("/", async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// Whitelisted fields only. The previous version copied the whole request body
// onto the document, which would let any staff member change fields such as the
// identity policy.
const GENERAL_FIELDS = ["address", "phone", "email"];

router.put("/", protect, adminOnly, async (req, res, next) => {
  try {
    const changes = Object.fromEntries(GENERAL_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(req.body, k)).map((k) => [k, req.body[k]]));
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(changes);
    } else {
      Object.assign(settings, changes);
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// Identity-verification policy per application type. Weakening it (e.g. "none")
// is a significant decision, so it is admin-only and audited.
router.put("/identity-policy", protect, requireRole("admin"), validateRequest(identityPolicySchema), async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    const previous = { adoption: settings.identityPolicy?.adoption, foster: settings.identityPolicy?.foster };
    if (req.body.adoption) settings.set("identityPolicy.adoption", req.body.adoption);
    if (req.body.foster) settings.set("identityPolicy.foster", req.body.foster);
    await settings.save();
    await writeAuditLog({
      actor: req.user._id,
      action: "settings.identity_policy.update",
      entityType: "Settings",
      entityId: settings._id,
      previousValues: previous,
      newValues: { adoption: settings.identityPolicy.adoption, foster: settings.identityPolicy.foster },
      req,
    });
    res.json({ success: true, data: settings.identityPolicy });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
