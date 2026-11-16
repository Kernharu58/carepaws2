const mongoose = require("mongoose");

const User = require("../models/User");
const UserDocument = require("../models/UserDocument");
const IdentityVerificationRecord = require("../models/IdentityVerificationRecord");
const Settings = require("../models/Settings");
const storage = require("./documentStorage");
const cfg = require("../config/identity");
const logger = require("../utils/logger");
const { notifyOnce } = require("../utils/notificationHelper");
const { writeAuditLog } = require("../utils/auditLogger");

/**
 * Centralised identity-verification service.
 *
 * Single source of truth for identity state. Nothing else may change
 * User.identityVerificationStatus (the User model rejects it), and nothing else
 * may change a government-ID UserDocument's review state.
 *
 * Model of record:
 *   - The authoritative record is ONE government-ID UserDocument per user,
 *     referenced by User.identityDocument.
 *   - User.identityVerificationStatus is a cache derived from it. Eligibility
 *     checks never trust the cache alone: evaluateIdentity() re-derives the
 *     status from the document, so a conflicting or tampered user row cannot
 *     grant access.
 *   - Every event appends an IdentityVerificationRecord (never updated).
 *
 * Concurrency: each state change starts with a conditional update on the
 * document's current status, so exactly one of N simultaneous requests wins and
 * the rest get 409. Writes run inside a MongoDB transaction when the
 * deployment supports them (replica set / Atlas); on a standalone mongod the
 * conditional updates still guarantee single-winner semantics, and any partial
 * write is repaired by reconcileUser().
 */

class IdentityError extends Error {
  constructor(statusCode, code, message, extra = {}) {
    super(message);
    this.name = "IdentityError";
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, extra);
  }
}

const WRITE = { [User.IDENTITY_WRITE_OPTION]: true };
const idStr = (v) => (v ? String(v._id || v) : null);
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const isReviewer = (user) => Boolean(user) && cfg.IDENTITY_REVIEWER_ROLES.includes(user.role);
const isAssistant = (user) => Boolean(user) && cfg.IDENTITY_ASSISTING_ROLES.includes(user.role);

// ---------------------------------------------------------------------------
// Status machine
// ---------------------------------------------------------------------------

function assertIdentityTransition(from, to) {
  const allowed = cfg.IDENTITY_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new IdentityError(409, "INVALID_STATUS_TRANSITION", `Identity status cannot change from "${from}" to "${to}"`, { from, to });
  }
}

// ---------------------------------------------------------------------------
// Transactions (where supported)
// ---------------------------------------------------------------------------

let transactionsSupported = null; // null = unknown

function detectTransactionSupport() {
  try {
    const type = mongoose.connection.getClient()?.topology?.description?.type;
    if (type) return ["ReplicaSetWithPrimary", "Sharded", "LoadBalanced"].includes(type);
  } catch {
    /* fall through */
  }
  return null;
}

function isTransactionUnsupported(err) {
  return err && (err.code === 20 || /Transaction numbers are only allowed|replica set member or mongos|does not support transactions/i.test(err.message || ""));
}

async function runInTransaction(work) {
  if (transactionsSupported === null) transactionsSupported = detectTransactionSupport();
  if (transactionsSupported === false) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    transactionsSupported = true;
    return result;
  } catch (err) {
    if (isTransactionUnsupported(err)) {
      transactionsSupported = false;
      return work(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

const opts = (session, extra = {}) => (session ? { session, ...extra } : { ...extra });

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

async function getIdentityPolicy() {
  const settings = await Settings.findOne().lean();
  const p = (settings && settings.identityPolicy) || {};
  return {
    adoption: p.adoption || cfg.DEFAULT_IDENTITY_POLICY.adoption,
    foster: p.foster || cfg.DEFAULT_IDENTITY_POLICY.foster,
  };
}

// ---------------------------------------------------------------------------
// Evaluation (never trusts the cached user status on its own)
// ---------------------------------------------------------------------------

const DOC_TO_IDENTITY = { pending: "pending", verified: "verified", rejected: "rejected", resubmission_required: "resubmission_required", expired: "expired" };

/**
 * Derives the effective identity state from the authoritative document.
 * Returns { status, document, conflict, expiresAt }.
 */
async function evaluateIdentity(userOrId, { now = new Date() } = {}) {
  const user = userOrId && userOrId._id ? userOrId : await User.findById(userOrId);
  if (!user) throw new IdentityError(404, "USER_NOT_FOUND", "User not found");

  const cached = user.identityVerificationStatus || "unverified";
  let doc = null;
  if (user.identityDocument) doc = await UserDocument.findById(user.identityDocument);

  const docValid = doc && doc.type === "government_id" && idStr(doc.user) === idStr(user._id) && DOC_TO_IDENTITY[doc.status];
  if (!docValid) {
    // No usable authoritative document: nobody is verified on the strength of a flag alone.
    return { status: "unverified", cachedStatus: cached, document: null, conflict: cached !== "unverified", expiresAt: null };
  }

  let status = DOC_TO_IDENTITY[doc.status];
  // A verified document must carry an actual reviewer decision.
  if (status === "verified" && !doc.verifiedBy) status = "unverified";
  if (status === "verified" && doc.expiresAt && doc.expiresAt <= now) status = "expired";
  return { status, cachedStatus: cached, document: doc, conflict: status !== cached, expiresAt: doc.expiresAt || null };
}

const IDENTITY_MESSAGES = {
  unverified: "Identity verification is required. Upload a valid government-issued ID (Profile > Documents) and wait for staff to review it.",
  pending: "Your ID is waiting for staff review. You can continue once it has been verified.",
  rejected: "Your ID was rejected. Please upload a new government-issued ID.",
  resubmission_required: "Staff need a replacement ID image. Please upload a new one.",
  expired: "Your verified ID has expired. Please upload a current government-issued ID.",
};

function identityMessage(status, { reason, forStaff } = {}) {
  let message = IDENTITY_MESSAGES[status] || IDENTITY_MESSAGES.unverified;
  if (forStaff) message = message.replace(/^Your ID/, "The applicant's ID").replace(/Your verified ID/, "The applicant's verified ID").replace(/Upload|Please upload/, "The applicant must upload");
  if ((status === "rejected" || status === "resubmission_required") && reason) message += ` Reason: ${reason}`;
  return message;
}

/**
 * Evaluates whether `applicant` may proceed for `applicationType`.
 * stage: "submit" (creating the application) or "advance" (moving past "submitted").
 * Returns { required, eligible, policy, identity:{status,...}, emailVerified, code, message }.
 */
async function checkEligibility(applicant, applicationType, { stage = "submit", forStaff = false, now = new Date() } = {}) {
  const type = applicationType === "foster" ? "foster" : "adoption";
  const policies = await getIdentityPolicy();
  const policy = policies[type];
  const required = policy === "none" ? false : policy === "before_submission" ? true : stage === "advance";

  const evaluated = await evaluateIdentity(applicant, { now });
  const reason = evaluated.document?.rejectedReason || applicant.identityVerificationNotes || null;
  const eligible = !required || evaluated.status === "verified";
  return {
    required,
    eligible,
    policy,
    emailVerified: Boolean(applicant.emailVerified), // reported independently; never implies identity
    identity: { status: evaluated.status, documentId: evaluated.document ? idStr(evaluated.document._id) : null, expiresAt: evaluated.expiresAt, conflict: evaluated.conflict },
    code: eligible ? null : "IDENTITY_NOT_VERIFIED",
    message: eligible ? null : identityMessage(evaluated.status, { reason, forStaff }),
  };
}

async function assertEligible(applicant, applicationType, options = {}) {
  const result = await checkEligibility(applicant, applicationType, options);
  if (!result.eligible) {
    throw new IdentityError(options.stage === "advance" ? 409 : 403, result.code, result.message, { identityStatus: result.identity.status, policy: result.policy });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function sniffMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.slice(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

function parseExpiry(value, { required, now }) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new IdentityError(400, "EXPIRY_REQUIRED", "This ID type has an expiry date. Enter it exactly as printed on the ID.");
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new IdentityError(400, "INVALID_EXPIRY", "Enter a valid expiry date.");
  // Valid through the end of the printed day.
  const endOfDay = new Date(date.getTime());
  endOfDay.setUTCHours(23, 59, 59, 999);
  if (endOfDay <= now) throw new IdentityError(400, "DOCUMENT_EXPIRED", "This ID has already expired. Please upload a current ID.");
  if (date.getTime() > addDays(now, 365 * 25).getTime()) throw new IdentityError(400, "INVALID_EXPIRY", "That expiry date is too far in the future.");
  return endOfDay;
}

function validateChecklist(checklist, { idType, hasExpiry }) {
  const failures = [];
  const missing = [];
  for (const item of cfg.CHECKLIST_ITEMS) {
    const value = checklist ? checklist[item] : undefined;
    if (!["pass", "fail", "na"].includes(value)) {
      missing.push(item);
      continue;
    }
    if (value === "fail") failures.push(item);
    if (value === "na") {
      if (!cfg.CHECKLIST_NA_ALLOWED.includes(item)) failures.push(item);
      // "Not expired: n/a" is only legitimate for an ID that has no expiry date.
      if (item === "notExpired" && (cfg.EXPIRY_REQUIRED_TYPES.includes(idType) || hasExpiry)) failures.push(item);
    }
  }
  return { missing, failures };
}

// ---------------------------------------------------------------------------
// Records, notifications, audit
// ---------------------------------------------------------------------------

async function appendRecord(entry, session) {
  const [record] = await IdentityVerificationRecord.create([entry], opts(session));
  return record;
}

async function safeNotify(args) {
  try {
    await notifyOnce(args);
  } catch (err) {
    logger.error({ err: { message: err.message }, type: args.type }, "Identity notification failed");
  }
}

const DECISION_NOTIFICATION = {
  approved: { type: "IDENTITY_VERIFIED", title: "Your ID has been verified", message: () => "Your government ID was reviewed and accepted. You can now apply to adopt or foster." },
  rejected: { type: "IDENTITY_REJECTED", title: "Your ID was rejected", message: (reason) => `Your ID could not be accepted. Reason: ${reason}. Please upload a new ID.` },
  resubmission_requested: { type: "IDENTITY_RESUBMISSION_REQUIRED", title: "Please upload your ID again", message: (reason) => `Staff need a replacement ID image. Reason: ${reason}.` },
  expired: { type: "IDENTITY_EXPIRED", title: "Your verified ID has expired", message: () => "Please upload a current government ID so you can keep applying." },
};

// ---------------------------------------------------------------------------
// Submission / replacement
// ---------------------------------------------------------------------------

/**
 * Stores a government ID for `ownerId`.
 * `actor` is the authenticated user performing the upload; when it differs
 * from the owner the upload is staff-assisted (walk-in process).
 */
async function submitDocument({ ownerId, actor, file, idType, expiresAt, req = null, now = new Date() }) {
  if (!file || !file.buffer) throw new IdentityError(400, "NO_FILE", "No file uploaded");
  if (!cfg.ID_TYPES.includes(idType)) throw new IdentityError(400, "INVALID_ID_TYPE", `ID type must be one of: ${cfg.ID_TYPES.join(", ")}`);

  const staffAssisted = idStr(ownerId) !== idStr(actor._id);
  if (staffAssisted && !isAssistant(actor)) throw new IdentityError(403, "NOT_ALLOWED", "You can only upload your own identity document");

  const owner = await User.findOne({ _id: ownerId, isDeleted: { $ne: true } });
  if (!owner) throw new IdentityError(404, "USER_NOT_FOUND", "Applicant not found");
  if (staffAssisted && owner.role !== "user") throw new IdentityError(400, "NOT_AN_APPLICANT", "Staff-assisted verification is only for applicant accounts");

  const sniffed = sniffMime(file.buffer);
  if (!sniffed || (file.mimetype && sniffed !== file.mimetype)) {
    throw new IdentityError(400, "FILE_TYPE_MISMATCH", "The file is not a valid JPEG, PNG, WebP or PDF");
  }
  const expiry = parseExpiry(expiresAt, { required: cfg.EXPIRY_REQUIRED_TYPES.includes(idType), now });

  // Bring a lapsed verification up to date first so replacement rules see the truth.
  await expireIfDue(owner, now);
  const evaluated = await evaluateIdentity(owner, { now });
  const hash = storage.sha256(file.buffer);

  const existing = await UserDocument.find({ user: owner._id, type: "government_id" }).select("status contentHash expiresAt");
  if (existing.some((d) => d.status === "pending")) {
    throw new IdentityError(409, "DUPLICATE_PENDING", "You already have an ID waiting for review. Wait for the decision or withdraw it first.");
  }

  let renewal = false;
  if (evaluated.status === "verified") {
    const daysLeft = evaluated.expiresAt ? (evaluated.expiresAt.getTime() - now.getTime()) / 86400000 : Infinity;
    if (daysLeft > cfg.RENEWAL_WINDOW_DAYS) {
      throw new IdentityError(409, "ALREADY_VERIFIED", "Your identity is already verified. You can upload a replacement when your ID is close to expiring.");
    }
    renewal = true;
  }
  if (existing.some((d) => d.contentHash === hash && ["verified", "rejected", "resubmission_required"].includes(d.status))) {
    throw new IdentityError(409, "DUPLICATE_FILE", "This is the same image you already submitted. Please upload a new photo or scan.");
  }

  const stored = await storage.storePrivate(file.buffer);
  const fromStatus = owner.identityVerificationStatus || "unverified";
  const previousDocId = owner.identityDocument || null;

  try {
    return await runInTransaction(async (session) => {
      const [doc] = await UserDocument.create(
        [
          {
            user: owner._id,
            application: null,
            type: "government_id",
            label: "Government ID",
            idType,
            storage: stored,
            fileType: sniffed,
            fileSize: file.size || file.buffer.length,
            contentHash: hash,
            expiresAt: expiry,
            status: "pending",
            submittedBy: actor._id,
            submissionChannel: staffAssisted ? "staff_assisted" : "self",
          },
        ],
        opts(session)
      );

      if (!renewal) {
        assertIdentityTransition(fromStatus === "pending" ? "unverified" : fromStatus, "pending");
        const res = await User.updateOne(
          { _id: owner._id, identityVerificationStatus: fromStatus, identityDocument: previousDocId },
          { $set: { identityVerificationStatus: "pending", identityDocument: doc._id, identityVerificationNotes: null, identityExpiresAt: null } },
          opts(session, WRITE)
        );
        if (res.matchedCount !== 1) throw new IdentityError(409, "CONFLICT", "Your identity status changed while uploading. Please try again.");
        // Earlier rejected / expired document: keep it as history, link forward.
        if (previousDocId) {
          await UserDocument.updateOne(
            { _id: previousDocId, supersededBy: null },
            { $set: { supersededBy: doc._id, supersededAt: now, imageDeleteAfter: addDays(now, cfg.RETENTION_DAYS_OTHER) } },
            opts(session)
          );
        }
      }

      await appendRecord(
        {
          user: owner._id,
          document: doc._id,
          action: staffAssisted ? "staff_assisted_submission" : "submitted",
          fromStatus,
          toStatus: renewal ? fromStatus : "pending",
          documentToStatus: "pending",
          actor: actor._id,
          actorRole: actor.role,
          idType,
          documentExpiresAt: expiry,
          metadata: { renewal, channel: staffAssisted ? "staff_assisted" : "self" },
        },
        session
      );
      return { document: doc, renewal };
    }).then(async (result) => {
      await writeAuditLog({ actor: actor._id, action: staffAssisted ? "identity.staff_assisted_submit" : "identity.submit", targetUser: owner._id, entityType: "UserDocument", entityId: result.document._id, newValues: { status: "pending", idType }, req });
      if (staffAssisted) {
        await safeNotify({
          recipient: owner._id,
          sender: actor._id,
          type: "IDENTITY_SUBMITTED",
          title: "Your ID was submitted for review",
          message: "Shelter staff uploaded your ID for verification. You will be notified of the decision.",
          refModel: "UserDocument",
          refId: result.document._id,
          dedupeKey: `identity:${result.document._id}:submitted`,
        });
      }
      return result;
    });
  } catch (err) {
    // The new upload never became a review item: remove the orphaned private file.
    await storage.destroy({ storage: stored }).catch((e) => logger.warn({ message: e.message }, "Orphaned identity upload cleanup failed"));
    if (err?.code === 11000) {
      throw new IdentityError(409, "DUPLICATE_PENDING", "You already have an ID waiting for review. Wait for the decision or withdraw it first.");
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Review (the ONLY way a government ID becomes verified / rejected)
// ---------------------------------------------------------------------------

const DECISIONS = { approve: "approved", reject: "rejected", request_resubmission: "resubmission_requested" };

async function reviewDocument({ documentId, reviewer, decision, checklist, reason, assessmentNote, expiresAt, req = null, now = new Date() }) {
  if (!DECISIONS[decision]) throw new IdentityError(400, "INVALID_DECISION", "Decision must be approve, reject or request_resubmission");
  if (!isReviewer(reviewer)) throw new IdentityError(403, "NOT_AUTHORIZED", "You are not authorised to review identity documents");

  const initial = await UserDocument.findById(documentId);
  if (!initial) throw new IdentityError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (initial.type !== "government_id") {
    throw new IdentityError(400, "NOT_AN_IDENTITY_DOCUMENT", "This is an application document. Review it from Document Review, not Identity Verification.");
  }
  if (idStr(initial.user) === idStr(reviewer._id)) throw new IdentityError(403, "SELF_REVIEW", "You cannot review your own identity document");
  if (initial.submittedBy && idStr(initial.submittedBy) === idStr(reviewer._id)) {
    throw new IdentityError(403, "SUBMITTER_CANNOT_REVIEW", "A different reviewer must decide on a document you uploaded on someone's behalf");
  }

  const trimmedReason = typeof reason === "string" ? reason.trim() : "";
  if (decision !== "approve" && trimmedReason.length < cfg.MIN_REASON_LENGTH) {
    throw new IdentityError(400, "REASON_REQUIRED", `A reason of at least ${cfg.MIN_REASON_LENGTH} characters is required to ${decision === "reject" ? "reject" : "request resubmission of"} an ID`);
  }
  if (trimmedReason.length > 500) throw new IdentityError(400, "REASON_TOO_LONG", "Reason must be 500 characters or fewer");

  const owner = await User.findOne({ _id: initial.user, isDeleted: { $ne: true } });
  if (!owner) throw new IdentityError(404, "USER_NOT_FOUND", "The applicant account no longer exists");

  // Which states this document may be decided from.
  const wasVerified = initial.status === "verified";
  if (decision === "approve" && initial.status !== "pending") {
    throw new IdentityError(409, "ALREADY_REVIEWED", `This document is already ${initial.status.replace(/_/g, " ")}`, { documentStatus: initial.status });
  }
  if (decision !== "approve" && !["pending", "verified"].includes(initial.status)) {
    throw new IdentityError(409, "ALREADY_REVIEWED", `This document is already ${initial.status.replace(/_/g, " ")}`, { documentStatus: initial.status });
  }
  if (wasVerified && idStr(owner.identityDocument) !== idStr(initial._id)) {
    throw new IdentityError(409, "NOT_CURRENT_DOCUMENT", "Only the applicant's current verified ID can be revoked");
  }

  let confirmedExpiry = null;
  let sanitizedChecklist = null;
  if (decision === "approve") {
    // 1. There must be a real, still-present document to have reviewed.
    const hasFile = !initial.fileRemovedAt && Boolean((initial.storage && initial.storage.publicId) || initial.fileUrl);
    if (!hasFile) throw new IdentityError(409, "NO_DOCUMENT_FILE", "An identity cannot be verified without a government ID image on file");
    // 2. This reviewer must actually have opened it.
    if (!initial.reviewViews.some((v) => idStr(v.reviewer) === idStr(reviewer._id))) {
      throw new IdentityError(409, "DOCUMENT_NOT_VIEWED", "Open and inspect the ID image before approving it");
    }
    // 3. Reviewer-confirmed expiry (the applicant's own entry is advisory).
    const expiryInput = expiresAt !== undefined ? expiresAt : initial.expiresAt;
    confirmedExpiry = parseExpiry(expiryInput, { required: cfg.EXPIRY_REQUIRED_TYPES.includes(initial.idType), now });
    // 4. Full checklist, every required item passing.
    const { missing, failures } = validateChecklist(checklist, { idType: initial.idType, hasExpiry: Boolean(confirmedExpiry) });
    if (missing.length) throw new IdentityError(400, "CHECKLIST_INCOMPLETE", `Complete every checklist item before approving: ${missing.join(", ")}`, { items: missing });
    if (failures.length) throw new IdentityError(400, "CHECKLIST_FAILED", `Cannot approve while checklist items fail: ${failures.join(", ")}. Reject or request resubmission instead.`, { items: failures });
    sanitizedChecklist = Object.fromEntries(cfg.CHECKLIST_ITEMS.map((k) => [k, checklist[k]]));
  } else if (checklist && typeof checklist === "object") {
    sanitizedChecklist = Object.fromEntries(cfg.CHECKLIST_ITEMS.filter((k) => ["pass", "fail", "na"].includes(checklist[k])).map((k) => [k, checklist[k]]));
  }

  const docTarget = decision === "approve" ? "verified" : decision === "reject" ? "rejected" : "resubmission_required";
  const action = decision === "approve" ? "approved" : wasVerified ? "revoked" : DECISIONS[decision];

  const result = await runInTransaction(async (session) => {
    const current = await UserDocument.findById(documentId).session(session || null);
    // Re-read the owner inside the unit of work.
    const user = await User.findById(owner._id).session(session || null);
    const isRenewalDoc = !wasVerified && user.identityDocument && idStr(user.identityDocument) !== idStr(current._id);
    const previousDocId = isRenewalDoc ? user.identityDocument : null;
    const fromUserStatus = user.identityVerificationStatus;

    // --- The lock: only one decision per document state can ever win. ---
    const set = {
      status: docTarget,
      verifiedBy: reviewer._id,
      verifiedAt: now,
      rejectedReason: decision === "approve" ? null : trimmedReason,
      assessmentType: cfg.ASSESSMENT_TYPE,
      checklist: sanitizedChecklist,
      notes: assessmentNote ? String(assessmentNote).slice(0, 1000) : current.notes,
      imageDeleteAfter: addDays(now, decision === "approve" ? cfg.RETENTION_DAYS_VERIFIED : cfg.RETENTION_DAYS_OTHER),
    };
    if (decision === "approve") set.expiresAt = confirmedExpiry;
    const decided = await UserDocument.findOneAndUpdate(
      { _id: current._id, status: wasVerified ? "verified" : "pending" },
      { $set: set },
      { new: true, ...opts(session) }
    );
    if (!decided) throw new IdentityError(409, "ALREADY_REVIEWED", "Another reviewer has just decided on this document. Refresh to see the result.");

    // --- Keep the user row in step (unless this is a rejected renewal). ---
    let toUserStatus = fromUserStatus;
    const touchesUser = !isRenewalDoc || decision === "approve";
    if (touchesUser) {
      toUserStatus = docTarget;
      // A renewal approval keeps the user "verified" (new document replaces old), so only
      // validate the user-level transition for the non-renewal paths.
      if (!isRenewalDoc) assertIdentityTransition(fromUserStatus, toUserStatus);
      const userSet = {
        identityVerificationStatus: toUserStatus,
        identityDocument: decided._id,
        identityVerifiedBy: reviewer._id,
        identityVerifiedAt: now,
        identityExpiresAt: decision === "approve" ? confirmedExpiry : null,
        identityVerificationNotes: decision === "approve" ? null : trimmedReason,
      };
      const guard = isRenewalDoc ? { identityDocument: previousDocId } : { identityDocument: decided._id };
      const res = await User.updateOne({ _id: user._id, ...guard }, { $set: userSet }, opts(session, WRITE));
      if (res.matchedCount !== 1) throw new IdentityError(409, "CONFLICT", "The applicant's identity record changed during review. Refresh and try again.");
    }

    // --- Approving a renewal retires the previously verified document. ---
    if (decision === "approve" && previousDocId) {
      const old = await UserDocument.findOneAndUpdate(
        { _id: previousDocId, status: { $in: ["verified", "expired"] } },
        { $set: { status: "superseded", supersededBy: decided._id, supersededAt: now, imageDeleteAfter: addDays(now, cfg.RETENTION_DAYS_OTHER) } },
        { new: true, ...opts(session) }
      );
      if (old) {
        await appendRecord({ user: user._id, document: old._id, action: "superseded", fromStatus: "verified", toStatus: "verified", documentFromStatus: "verified", documentToStatus: "superseded", actor: reviewer._id, actorRole: reviewer.role, idType: old.idType, metadata: { supersededBy: String(decided._id) } }, session);
      }
    }

    await appendRecord(
      {
        user: user._id,
        document: decided._id,
        action,
        fromStatus: fromUserStatus,
        toStatus: toUserStatus,
        documentFromStatus: wasVerified ? "verified" : "pending",
        documentToStatus: docTarget,
        actor: reviewer._id,
        actorRole: reviewer.role,
        reason: decision === "approve" ? (assessmentNote ? String(assessmentNote).slice(0, 1000) : null) : trimmedReason,
        checklist: sanitizedChecklist,
        assessmentType: cfg.ASSESSMENT_TYPE,
        idType: decided.idType,
        documentExpiresAt: decided.expiresAt,
        metadata: { disclaimer: cfg.REVIEW_DISCLAIMER, renewal: Boolean(isRenewalDoc) },
      },
      session
    );
    return { document: decided, userId: user._id };
  });

  await writeAuditLog({
    actor: reviewer._id,
    action: `identity.${action === "approved" ? "approve" : action === "revoked" ? "revoke" : decision}`,
    targetUser: owner._id,
    entityType: "UserDocument",
    entityId: result.document._id,
    previousValues: { status: wasVerified ? "verified" : "pending" },
    newValues: { status: docTarget },
    metadata: { idType: result.document.idType },
    req,
  });

  const notice = DECISION_NOTIFICATION[DECISIONS[decision]];
  await safeNotify({
    recipient: owner._id,
    sender: reviewer._id,
    type: notice.type,
    title: notice.title,
    message: notice.message(trimmedReason),
    refModel: "UserDocument",
    refId: result.document._id,
    dedupeKey: `identity:${result.document._id}:${action}:${now.getTime()}`,
  });

  return result.document;
}

// ---------------------------------------------------------------------------
// Viewing
// ---------------------------------------------------------------------------

function canViewDocument(viewer, doc) {
  if (!viewer || !doc) return false;
  if (idStr(doc.user) === idStr(viewer._id)) return true;
  if (doc.type === "government_id") return isReviewer(viewer);
  return ["staff", "admin", "super_admin"].includes(viewer.role);
}

/** Authorises the viewer, records reviewer views, and returns the file stream. */
async function openDocumentFile({ documentId, viewer, req = null }) {
  const doc = await UserDocument.findById(documentId);
  if (!doc) throw new IdentityError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (!canViewDocument(viewer, doc)) throw new IdentityError(403, "NOT_AUTHORIZED", "You are not authorised to view this document");

  const opened = await storage.openStream(doc);

  const isOwner = idStr(doc.user) === idStr(viewer._id);
  if (!isOwner && doc.type === "government_id") {
    await UserDocument.updateOne({ _id: doc._id }, { $push: { reviewViews: { $each: [{ reviewer: viewer._id, at: new Date() }], $slice: -50 } } });
    await writeAuditLog({ actor: viewer._id, action: "identity.document_view", targetUser: doc.user, entityType: "UserDocument", entityId: doc._id, req });
  }
  return { ...opened, document: doc };
}

// ---------------------------------------------------------------------------
// Withdraw / remove
// ---------------------------------------------------------------------------

async function removeDocument({ documentId, actor, req = null, now = new Date() }) {
  const doc = await UserDocument.findById(documentId);
  if (!doc || idStr(doc.user) !== idStr(actor._id)) {
    // Same answer whether it doesn't exist or belongs to someone else.
    throw new IdentityError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }
  if (doc.type !== "government_id") throw new IdentityError(400, "NOT_AN_IDENTITY_DOCUMENT", "Not an identity document");

  const user = await User.findById(actor._id);
  const isCurrentVerified = doc.status === "verified" && idStr(user.identityDocument) === idStr(doc._id);
  if (isCurrentVerified) {
    throw new IdentityError(409, "VERIFIED_ID_PROTECTED", "This ID supports your verified identity and cannot be deleted. Upload a replacement instead; your current ID stays on file until the new one is approved.");
  }
  if (doc.status === "verified") {
    // A verified document that is no longer the user's authoritative one: treat as history.
    throw new IdentityError(409, "VERIFIED_ID_PROTECTED", "Verified identity documents cannot be deleted");
  }

  const wasPending = doc.status === "pending";
  const isRenewalDoc = wasPending && user.identityDocument && idStr(user.identityDocument) !== idStr(doc._id);

  const updated = await runInTransaction(async (session) => {
    const changed = await UserDocument.findOneAndUpdate(
      { _id: doc._id, status: doc.status },
      wasPending
        ? { $set: { status: "withdrawn", fileRemovedAt: now, imageDeleteAfter: null, "storage.publicId": null }, $unset: {} }
        : { $set: { fileRemovedAt: now, imageDeleteAfter: null, "storage.publicId": null } },
      { new: true, ...opts(session) }
    );
    if (!changed) throw new IdentityError(409, "CONFLICT", "This document was just reviewed. Refresh to see the result.");

    let toStatus = user.identityVerificationStatus;
    if (wasPending && !isRenewalDoc) {
      assertIdentityTransition("pending", "unverified");
      toStatus = "unverified";
      const res = await User.updateOne(
        { _id: user._id, identityDocument: doc._id, identityVerificationStatus: "pending" },
        { $set: { identityVerificationStatus: "unverified", identityDocument: null, identityExpiresAt: null, identityVerificationNotes: null } },
        opts(session, WRITE)
      );
      if (res.matchedCount !== 1) throw new IdentityError(409, "CONFLICT", "Your identity status changed. Please refresh.");
    }
    await appendRecord(
      {
        user: user._id,
        document: doc._id,
        action: wasPending ? "withdrawn" : "image_purged",
        fromStatus: user.identityVerificationStatus,
        toStatus,
        documentFromStatus: doc.status,
        documentToStatus: changed.status,
        actor: actor._id,
        actorRole: actor.role,
        idType: doc.idType,
        metadata: { requestedByApplicant: true },
      },
      session
    );
    return changed;
  });

  // Delete the stored image only after the record is safely written.
  await storage.destroy(doc).catch((e) => logger.warn({ message: e.message, documentId: String(doc._id) }, "Identity image deletion failed"));
  await writeAuditLog({ actor: actor._id, action: wasPending ? "identity.withdraw" : "identity.image_remove", targetUser: actor._id, entityType: "UserDocument", entityId: doc._id, req });
  return updated;
}

// ---------------------------------------------------------------------------
// Expiry, reconciliation, retention
// ---------------------------------------------------------------------------

async function expireIfDue(user, now = new Date()) {
  if (user.identityVerificationStatus !== "verified" || !user.identityDocument) return false;
  const doc = await UserDocument.findById(user.identityDocument);
  if (!doc || doc.status !== "verified" || !doc.expiresAt || doc.expiresAt > now) return false;
  return expireDocument(doc, now);
}

async function expireDocument(doc, now = new Date()) {
  const done = await runInTransaction(async (session) => {
    const changed = await UserDocument.findOneAndUpdate(
      { _id: doc._id, status: "verified", expiresAt: { $lte: now } },
      { $set: { status: "expired", imageDeleteAfter: addDays(now, cfg.RETENTION_DAYS_OTHER) } },
      { new: true, ...opts(session) }
    );
    if (!changed) return false; // someone else expired/changed it
    const res = await User.updateOne(
      { _id: doc.user, identityDocument: doc._id, identityVerificationStatus: "verified" },
      { $set: { identityVerificationStatus: "expired", identityExpiresAt: doc.expiresAt } },
      opts(session, WRITE)
    );
    await appendRecord(
      {
        user: doc.user,
        document: doc._id,
        action: "expired",
        fromStatus: "verified",
        toStatus: res.matchedCount === 1 ? "expired" : null,
        documentFromStatus: "verified",
        documentToStatus: "expired",
        actor: null,
        actorRole: "system",
        idType: doc.idType,
        documentExpiresAt: doc.expiresAt,
      },
      session
    );
    return res.matchedCount === 1;
  });
  if (done) {
    await safeNotify({
      recipient: doc.user,
      type: DECISION_NOTIFICATION.expired.type,
      title: DECISION_NOTIFICATION.expired.title,
      message: DECISION_NOTIFICATION.expired.message(),
      refModel: "UserDocument",
      refId: doc._id,
      dedupeKey: `identity:${doc._id}:expired`,
    });
  }
  return done;
}

/** Cron + queue-read hook: expires every verified ID whose date has passed. */
async function expireDueIdentities(now = new Date()) {
  const due = await UserDocument.find({ type: "government_id", status: "verified", expiresAt: { $ne: null, $lte: now } });
  let expired = 0;
  for (const doc of due) {
    if (await expireDocument(doc, now)) expired += 1;
  }
  return expired;
}

/**
 * Repairs the cached user status from the authoritative document (e.g. after
 * a crash between the two writes on a standalone MongoDB, or legacy/tampered
 * data). Returns { changed, from, to }.
 */
async function reconcileUser(userId, { actor = null, now = new Date() } = {}) {
  const user = await User.findById(userId);
  if (!user) throw new IdentityError(404, "USER_NOT_FOUND", "User not found");
  const evaluated = await evaluateIdentity(user, { now });
  const from = user.identityVerificationStatus;

  let to = evaluated.status;
  const set = {};
  if (!evaluated.document) {
    // No usable authoritative document. What the cached status becomes:
    //   verified / expired        -> resubmission_required (they were relying on a record that is not there;
    //                                tell them what to do rather than silently resetting them)
    //   pending                   -> unverified (nothing is waiting for review)
    //   unverified / rejected / resubmission_required -> unchanged (already a safe, actionable state)
    if (["verified", "expired"].includes(from)) {
      to = "resubmission_required";
      set.identityVerificationNotes = "We could not find a complete review record for your ID. Please upload it again.";
    } else if (from === "pending") {
      to = "unverified";
      set.identityVerificationNotes = null;
    } else {
      to = from;
    }
    if (to !== from || user.identityDocument || user.identityExpiresAt) {
      set.identityDocument = null;
      set.identityExpiresAt = null;
    }
  } else {
    if (evaluated.document && idStr(user.identityDocument) !== idStr(evaluated.document._id)) set.identityDocument = evaluated.document._id;
    set.identityExpiresAt = evaluated.document.expiresAt || null;
  }
  if (from === to && Object.keys(set).length === 0) return { changed: false, from, to };
  if (from === to && !evaluated.document && !user.identityDocument && !user.identityExpiresAt) return { changed: false, from, to };
  if (from === to && evaluated.document && idStr(user.identityDocument) === idStr(evaluated.document._id) && idStr(user.identityExpiresAt) === idStr(evaluated.document.expiresAt)) {
    return { changed: false, from, to };
  }
  set.identityVerificationStatus = to;

  await User.updateOne({ _id: user._id }, { $set: set }, WRITE);
  await IdentityVerificationRecord.create({
    user: user._id,
    document: evaluated.document ? evaluated.document._id : null,
    action: "status_reconciled",
    fromStatus: from,
    toStatus: to,
    actor: actor ? actor._id : null,
    actorRole: actor ? actor.role : "system",
    metadata: { derivedFrom: evaluated.document ? "document" : "no_document" },
  });
  return { changed: true, from, to };
}

/** Deletes stored images whose retention period has ended. Records are kept. */
async function purgeStaleImages(now = new Date()) {
  const stale = await UserDocument.find({
    type: "government_id",
    fileRemovedAt: null,
    imageDeleteAfter: { $ne: null, $lte: now },
    status: { $ne: "pending" },
  }).limit(500);
  let purged = 0;
  for (const doc of stale) {
    try {
      await storage.destroy(doc);
      await UserDocument.updateOne({ _id: doc._id }, { $set: { fileRemovedAt: now, "storage.publicId": null, fileUrl: null } });
      await IdentityVerificationRecord.create({ user: doc.user, document: doc._id, action: "image_purged", documentFromStatus: doc.status, documentToStatus: doc.status, actor: null, actorRole: "system", idType: doc.idType, metadata: { reason: "retention_period_ended" } });
      purged += 1;
    } catch (err) {
      logger.error({ message: err.message, documentId: String(doc._id) }, "Identity image purge failed");
    }
  }
  return purged;
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

function applicantView(doc) {
  if (!doc) return null;
  const json = doc.toJSON();
  for (const k of ["verifiedBy", "checklist", "submittedBy", "notes", "assessmentType", "imageDeleteAfter"]) delete json[k];
  return json;
}

async function getMyIdentity(user, { now = new Date() } = {}) {
  await expireIfDue(user, now);
  const fresh = await User.findById(user._id);
  const evaluated = await evaluateIdentity(fresh, { now });
  const policies = await getIdentityPolicy();
  const docs = await UserDocument.find({ user: fresh._id, type: "government_id" }).sort({ createdAt: -1 }).limit(10);
  const latest = docs[0] || null;
  const pending = docs.find((d) => d.status === "pending") || null;
  const current = evaluated.document;
  const daysLeft = evaluated.expiresAt ? Math.ceil((evaluated.expiresAt.getTime() - now.getTime()) / 86400000) : null;
  const inRenewalWindow = evaluated.status === "verified" && daysLeft !== null && daysLeft <= cfg.RENEWAL_WINDOW_DAYS;

  const status = evaluated.status;
  const canUpload = !pending && (["unverified", "rejected", "resubmission_required", "expired"].includes(status) || inRenewalWindow);
  const history = await IdentityVerificationRecord.find({ user: fresh._id }).sort({ createdAt: -1 }).limit(25).select("action toStatus reason createdAt idType");
  // Reason to show: from the latest decided (non-verified) document.
  const reasonDoc = ["rejected", "resubmission_required"].includes(status) ? current : latest && ["rejected", "resubmission_required"].includes(latest.status) ? latest : null;

  return {
    status,
    emailVerified: Boolean(fresh.emailVerified), // independent of identity
    reason: reasonDoc ? reasonDoc.rejectedReason || null : null,
    expiresAt: evaluated.expiresAt,
    daysUntilExpiry: daysLeft,
    expiringSoon: inRenewalWindow,
    document: applicantView(pending || current || latest),
    pendingDocument: applicantView(pending),
    canUpload,
    canWithdraw: Boolean(pending),
    isRenewal: Boolean(canUpload && status === "verified"),
    idTypes: cfg.ID_TYPES.map((value) => ({ value, label: cfg.ID_TYPE_LABELS[value], expiryRequired: cfg.EXPIRY_REQUIRED_TYPES.includes(value) })),
    policy: policies,
    history: history.map((h) => ({ _id: h._id, action: h.action, status: h.toStatus, reason: h.reason, idType: h.idType, createdAt: h.createdAt })),
  };
}

async function listQueue({ status = "pending", page = 1, limit = 20, search = "", now = new Date() } = {}) {
  await expireDueIdentities(now);
  const filter = { type: "government_id" };
  if (status && status !== "all") filter.status = status;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  let userIds = null;
  if (search && String(search).trim()) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    userIds = (await User.find({ $or: [{ displayName: rx }, { email: rx }] }).select("_id").limit(200)).map((u) => u._id);
    filter.user = { $in: userIds };
  }
  const total = await UserDocument.countDocuments(filter);
  const rows = await UserDocument.find(filter)
    .sort({ createdAt: status === "pending" ? 1 : -1 }) // oldest pending first
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .populate("user", "displayName email phone address emailVerified identityVerificationStatus identityDocument")
    .populate("verifiedBy", "displayName");
  const data = rows.map((d) => {
    const json = d.toJSON();
    const owner = d.user;
    json.isRenewal = Boolean(d.status === "pending" && owner && owner.identityDocument && idStr(owner.identityDocument) !== idStr(d._id));
    json.isExpired = Boolean(d.expiresAt && d.expiresAt <= now) || d.status === "expired";
    return json;
  });
  return { data, pagination: { page: safePage, limit: safeLimit, total, pages: Math.max(Math.ceil(total / safeLimit), 1) } };
}

async function getDocumentDetail(documentId, viewer, { now = new Date() } = {}) {
  const doc = await UserDocument.findById(documentId)
    .populate("user", "displayName email phone address emailVerified identityVerificationStatus identityDocument")
    .populate("verifiedBy", "displayName")
    .populate("submittedBy", "displayName role");
  if (!doc) throw new IdentityError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.type !== "government_id") throw new IdentityError(400, "NOT_AN_IDENTITY_DOCUMENT", "Not an identity document");
  if (!isReviewer(viewer)) throw new IdentityError(403, "NOT_AUTHORIZED", "You are not authorised to view identity documents");

  const history = await IdentityVerificationRecord.find({ user: doc.user._id }).sort({ createdAt: -1 }).limit(100).populate("actor", "displayName role");
  const sameImageOtherAccounts = doc.contentHash ? await UserDocument.countDocuments({ contentHash: doc.contentHash, user: { $ne: doc.user._id } }) : 0;
  const json = doc.toJSON();
  json.isExpired = Boolean(doc.expiresAt && doc.expiresAt <= now) || doc.status === "expired";
  json.isRenewal = Boolean(doc.status === "pending" && doc.user.identityDocument && idStr(doc.user.identityDocument) !== idStr(doc._id));
  json.viewedByYou = doc.reviewViews.some((v) => idStr(v.reviewer) === idStr(viewer._id));
  json.canReview = !(idStr(doc.user._id) === idStr(viewer._id)) && !(doc.submittedBy && idStr(doc.submittedBy._id) === idStr(viewer._id));
  return {
    document: json,
    history: history.map((h) => h.toJSON()),
    warnings: sameImageOtherAccounts > 0 ? [`This exact image has also been submitted from ${sameImageOtherAccounts} other account(s).`] : [],
    checklist: cfg.CHECKLIST_ITEMS.map((key) => ({ key, label: cfg.CHECKLIST_LABELS[key], naAllowed: cfg.CHECKLIST_NA_ALLOWED.includes(key) })),
    disclaimer: cfg.REVIEW_DISCLAIMER,
    minReasonLength: cfg.MIN_REASON_LENGTH,
  };
}

async function getUserIdentityForStaff(userId, viewer) {
  if (!["staff", "admin", "super_admin"].includes(viewer.role)) throw new IdentityError(403, "NOT_AUTHORIZED", "Not authorised");
  const user = await User.findById(userId).select("displayName email identityVerificationStatus identityDocument identityVerifiedAt identityVerifiedBy identityExpiresAt");
  if (!user) throw new IdentityError(404, "USER_NOT_FOUND", "User not found");
  const evaluated = await evaluateIdentity(user);
  const history = await IdentityVerificationRecord.find({ user: user._id }).sort({ createdAt: -1 }).limit(100).populate("actor", "displayName role");
  const pending = await UserDocument.findOne({ user: user._id, type: "government_id", status: "pending" }).select("_id createdAt idType");
  return {
    user: { _id: user._id, displayName: user.displayName, email: user.email },
    status: evaluated.status,
    conflict: evaluated.conflict,
    expiresAt: evaluated.expiresAt,
    pendingDocumentId: pending ? pending._id : null,
    history: history.map((h) => h.toJSON()),
  };
}

module.exports = {
  IdentityError,
  assertIdentityTransition,
  runInTransaction,
  getIdentityPolicy,
  evaluateIdentity,
  checkEligibility,
  assertEligible,
  identityMessage,
  submitDocument,
  reviewDocument,
  removeDocument,
  openDocumentFile,
  canViewDocument,
  expireIfDue,
  expireDueIdentities,
  reconcileUser,
  purgeStaleImages,
  getMyIdentity,
  listQueue,
  getDocumentDetail,
  getUserIdentityForStaff,
  applicantView,
  isReviewer,
  isAssistant,
  sniffMime,
  _internal: { parseExpiry, validateChecklist },
};
