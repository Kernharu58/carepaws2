const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Archive = require("../models/Archive");
const { protect, requireRole } = require("../middleware/authMiddleware");

// -----------------------------------------------------------------------
// SECURITY NOTE — read before re-enabling this router anywhere
// -----------------------------------------------------------------------
// This router is intentionally NOT mounted in server.js (see the comment
// above the commented-out `app.use("/api/archive", ...)` line there).
//
// It used to resolve the target model with
// `mongoose.models[req.params.collection]` — a user-controlled URL
// segment used directly as a lookup key. Because server.js requires
// nearly every route/controller/model at boot, that lookup could reach
// essentially any model in the app (User, Payment, ApiKey,
// TokenBlacklist, Session, Role, even AuditLog itself), gated only by
// requireRole("admin", "super_admin") — a broad role check, not a
// per-entity authorization decision. Any admin/super_admin account could
// hard-delete a document from any of those collections just by knowing
// its Mongoose model name.
//
// It's also unused: nothing in lykasAdmin or lykasUser calls
// /api/archive/*, and it isn't part of the manuscript's functional
// scope. The app's real "archive" behavior is the
// isDeleted/deletedAt/deletedBy soft-delete pattern already implemented
// per-entity (Pet, User, Volunteer, InKindDonation — see the root
// README's "Soft delete" convention), each of which also writes to
// AuditLog via writeAuditLog() (see utils/auditLogger.js). This generic
// endpoint bypassed all of that: it hard-deletes the source document via
// findByIdAndDelete and never touches AuditLog. Routing an
// already-covered entity through here would both orphan any document
// that references it (Applications/Payments/Notifications keep pointing
// at a _id that's no longer in its collection) and create a gap in the
// manuscript's required tamper-evident audit trail — not just duplicate
// functionality that already exists safely elsewhere.
//
// The code below is kept, hardened, and unit-tested in case a future
// entity genuinely needs generic archiving and does NOT already have its
// own soft-delete route. To bring it back:
//   1. Add the entity to ARCHIVABLE_COLLECTIONS below.
//   2. Confirm no dedicated soft-delete route already exists for it.
//   3. Wire in an AuditLog write (utils/auditLogger.js) so archiving
//      through this path is tamper-evident like every other admin
//      action.
//   4. Re-add the `app.use("/api/archive", ...)` line in server.js.
// Until then, ARCHIVABLE_COLLECTIONS stays empty and every request here
// returns a safe "unsupported collection" error — this router is
// provably inert even if it's accidentally mounted somewhere.
// -----------------------------------------------------------------------

// A Map, not a plain object or array — a collection name can never
// resolve via the prototype chain this way. `{}["constructor"]` or
// `{}["__proto__"]` silently returns a real value on a plain object;
// `Map#get` only ever returns something that was explicitly `set`, so
// there is no allowlist-bypass-via-inherited-property class of bug here.
const ARCHIVABLE_COLLECTIONS = new Map([
  // ["SomeModel", require("../models/SomeModel")],
]);

function resolveArchivableModel(collection) {
  return typeof collection === "string" ? ARCHIVABLE_COLLECTIONS.get(collection) || null : null;
}

router.get("/", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.sourceCollection) filter.sourceCollection = req.query.sourceCollection;
    const archived = await Archive.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: archived });
  } catch (err) {
    next(err);
  }
});

// POST /api/archive/:collection — archives a document out of its normal
// collection entirely (the "second-tier trash can" per §5.1), not just
// the isDeleted soft-delete flag. Restricted to an explicit allowlist —
// see the security note above for why arbitrary model lookup was
// removed.
router.post("/:collection", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const { collection } = req.params;
    const { id, reason } = req.body;

    const model = resolveArchivableModel(collection);
    if (!model) {
      return res.status(400).json({ success: false, message: `Unsupported collection: ${collection}` });
    }

    // Guards two things at once: a malformed id (CastError -> 500
    // further down) and an *absent* id, where Mongoose's findById(undefined)
    // has historically been known to behave unpredictably rather than
    // cleanly erroring.
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid document id" });
    }

    const doc = await model.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    const archived = await Archive.create({
      sourceCollection: collection,
      originalId: doc._id,
      data: doc.toObject(),
      reason,
      archivedBy: req.user._id,
    });

    await model.findByIdAndDelete(id);

    res.status(201).json({ success: true, data: archived });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/restore", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid archive id" });
    }

    const archived = await Archive.findById(req.params.id);
    if (!archived) return res.status(404).json({ success: false, message: "Archive entry not found" });

    // Same allowlist as the create path above — an old Archive row from
    // before this fix could still reference a collection that was never
    // meant to be generically restorable. Restoring calls model.create()
    // with attacker-influenced stored data, so this needs the same gate
    // as archiving does, not a looser one.
    const model = resolveArchivableModel(archived.sourceCollection);
    if (!model) {
      return res.status(400).json({ success: false, message: `Unsupported collection: ${archived.sourceCollection}` });
    }

    const { _id, ...data } = archived.data;
    await model.create({ ...data, _id: archived.originalId });

    archived.restoredAt = new Date();
    archived.restoredBy = req.user._id;
    await archived.save();

    res.json({ success: true, data: archived });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
// Named exports for unit testing the allowlist mechanism directly,
// without needing an HTTP round-trip. Same pattern already used by
// models/Notification.js (module.exports.NOTIFICATION_TYPES) and
// routes/messageRoutes.js (module.exports.chatSessionsRouter).
module.exports.ARCHIVABLE_COLLECTIONS = ARCHIVABLE_COLLECTIONS;
module.exports.resolveArchivableModel = resolveArchivableModel;
