const UserDocument = require("../models/UserDocument");
const Application = require("../models/Application");
const storage = require("../services/documentStorage");
const identity = require("../services/identityVerificationService");
const logger = require("../utils/logger");

/**
 * APPLICATION documents (proof of address, income, house photos, ...).
 *
 * Government IDs are NOT handled here - identity verification is account-level
 * and lives in identityController / identityVerificationService. This
 * controller refuses to upload, delete or review them so the two verification
 * kinds can never be mixed up.
 */

const USE_IDENTITY_ENDPOINT = {
  success: false,
  code: "USE_IDENTITY_ENDPOINT",
  message: "Government IDs are handled by the identity verification endpoints (/api/identity).",
};

function fail(err, res, next) {
  if (err instanceof identity.IdentityError) {
    return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
  }
  if (err?.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
  return next(err);
}

async function myDocuments(req, res, next) {
  try {
    const docs = await UserDocument.find({ user: req.user._id }).sort({ createdAt: -1 });
    // Applicants see their own ID record without reviewer-internal fields.
    const data = docs.map((d) => (d.type === "government_id" ? identity.applicantView(d) : d.toJSON()));
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Resolves which application (if any) a newly uploaded document should be
// linked to. Where a caller supplies an id it is trusted only after confirming
// it belongs to this applicant. Where none is supplied it is inferred only when
// unambiguous: exactly one application in progress for this applicant.
async function resolveApplicationId(req) {
  if (req.body.application) {
    const application = await Application.findOne({ _id: req.body.application, applicant: req.user._id }).select("_id status");
    if (!application) throw Object.assign(new Error("Application not found"), { statusCode: 404 });
    if (application.status !== "pending") {
      throw Object.assign(new Error("Documents can only be uploaded while an application is in progress"), { statusCode: 409 });
    }
    return application._id;
  }
  const open = await Application.find({ applicant: req.user._id, status: "pending" }).select("_id").limit(2);
  return open.length === 1 ? open[0]._id : null;
}

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    if (req.body.type === "government_id") return res.status(400).json(USE_IDENTITY_ENDPOINT);
    if (!req.body.type) return res.status(400).json({ success: false, message: "Document type is required" });

    const sniffed = identity.sniffMime(req.file.buffer);
    if (!sniffed || sniffed !== req.file.mimetype) {
      return res.status(400).json({ success: false, code: "FILE_TYPE_MISMATCH", message: "The file is not a valid JPEG, PNG, WebP or PDF" });
    }

    const applicationId = await resolveApplicationId(req);
    // Stored privately: no public URL exists for the file.
    const stored = await storage.storePrivate(req.file.buffer);
    let doc;
    try {
      doc = await UserDocument.create({
        user: req.user._id,
        application: applicationId,
        type: req.body.type,
        label: req.body.label,
        storage: stored,
        fileType: sniffed,
        fileSize: req.file.size,
        contentHash: storage.sha256(req.file.buffer),
      });
    } catch (err) {
      await storage.destroy({ storage: stored }).catch(() => {});
      throw err;
    }
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return fail(err, res, next);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await UserDocument.findOne({ _id: req.params.id, user: req.user._id });
    if (!existing) return res.status(404).json({ success: false, message: "Document not found" });

    // Government IDs follow the controlled withdraw / protected-delete rules.
    if (existing.type === "government_id") {
      const doc = await identity.removeDocument({ documentId: existing._id, actor: req.user, req });
      return res.json({ success: true, data: identity.applicantView(doc) });
    }
    await UserDocument.deleteOne({ _id: existing._id });
    await storage.destroy(existing).catch((e) => logger.warn({ message: e.message }, "Document file cleanup failed"));
    return res.json({ success: true });
  } catch (err) {
    return fail(err, res, next);
  }
}

// Application documents only. Identity documents are listed by /api/identity/queue.
async function list(req, res, next) {
  try {
    const filter = { type: { $ne: "government_id" } };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type && req.query.type !== "government_id") filter.type = req.query.type;
    if (req.query.application) filter.application = req.query.application;
    const data = await UserDocument.find(filter)
      .populate("user", "displayName email")
      .populate({ path: "application", select: "pet applicant status stage type", populate: { path: "pet", select: "name" } })
      .sort({ createdAt: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Allowed review transitions for APPLICATION documents. (Never back to pending.)
const APPLICATION_DOC_TRANSITIONS = { pending: ["verified", "rejected"], verified: ["rejected"], rejected: ["verified"] };

async function verify(req, res, next) {
  try {
    const doc = await UserDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    if (doc.type === "government_id") {
      return res.status(400).json({
        success: false,
        code: "USE_IDENTITY_REVIEW",
        message: "Identity documents are reviewed in Identity Verification (POST /api/identity/documents/:id/review).",
      });
    }
    if (String(doc.user) === String(req.user._id)) {
      return res.status(403).json({ success: false, code: "SELF_REVIEW", message: "You cannot review your own document" });
    }
    const allowed = APPLICATION_DOC_TRANSITIONS[doc.status] || [];
    if (!allowed.includes(req.body.status)) {
      return res.status(409).json({ success: false, code: "INVALID_STATUS_TRANSITION", message: `A ${doc.status} document cannot become ${req.body.status}` });
    }

    doc.status = req.body.status;
    doc.verifiedBy = req.user._id;
    doc.verifiedAt = new Date();
    if (Object.prototype.hasOwnProperty.call(req.body, "rejectedReason")) doc.rejectedReason = req.body.rejectedReason;
    else if (doc.status !== "rejected") doc.rejectedReason = undefined;
    await doc.save();
    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents/:id/file - owner, or staff for application documents.
async function file(req, res, next) {
  try {
    const { stream, contentType, document } = await identity.openDocumentFile({ documentId: req.params.id, viewer: req.user, req });
    res.set({
      "Content-Type": document.fileType || contentType || "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="document"',
    });
    stream.on("error", () => res.destroy());
    return stream.pipe(res);
  } catch (err) {
    return fail(err, res, next);
  }
}

module.exports = { myDocuments, upload, remove, list, verify, file };
