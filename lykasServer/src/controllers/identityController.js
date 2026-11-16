const identity = require("../services/identityVerificationService");
const cfg = require("../config/identity");

// Domain errors carry a machine-readable `code` the apps map to messages.
function fail(err, res, next) {
  if (err instanceof identity.IdentityError) {
    const body = { success: false, code: err.code, message: err.message };
    if (err.items) body.items = err.items;
    if (err.documentStatus) body.documentStatus = err.documentStatus;
    return res.status(err.statusCode).json(body);
  }
  return next(err);
}

// GET /api/identity/me
async function me(req, res, next) {
  try {
    return res.json({ success: true, data: await identity.getMyIdentity(req.user) });
  } catch (err) {
    return fail(err, res, next);
  }
}

// GET /api/identity/policy
async function policy(req, res, next) {
  try {
    return res.json({ success: true, data: await identity.getIdentityPolicy() });
  } catch (err) {
    return fail(err, res, next);
  }
}

// POST /api/identity/documents  (multipart: file, idType, expiresAt?)
async function uploadMine(req, res, next) {
  try {
    const result = await identity.submitDocument({ ownerId: req.user._id, actor: req.user, file: req.file, idType: req.body.idType, expiresAt: req.body.expiresAt, req });
    return res.status(201).json({ success: true, data: identity.applicantView(result.document), renewal: result.renewal });
  } catch (err) {
    return fail(err, res, next);
  }
}

// POST /api/identity/walk-in/:userId/documents  (staff-assisted)
async function uploadForApplicant(req, res, next) {
  try {
    const result = await identity.submitDocument({ ownerId: req.params.userId, actor: req.user, file: req.file, idType: req.body.idType, expiresAt: req.body.expiresAt, req });
    return res.status(201).json({ success: true, data: { _id: result.document._id, status: result.document.status, idType: result.document.idType }, renewal: result.renewal });
  } catch (err) {
    return fail(err, res, next);
  }
}

// DELETE /api/identity/documents/:id  (withdraw pending / remove image of a decided one)
async function withdraw(req, res, next) {
  try {
    const doc = await identity.removeDocument({ documentId: req.params.id, actor: req.user, req });
    return res.json({ success: true, data: identity.applicantView(doc) });
  } catch (err) {
    return fail(err, res, next);
  }
}

// GET /api/identity/queue
async function queue(req, res, next) {
  try {
    const { q, ...rest } = req.query;
    const { data, pagination } = await identity.listQueue({ ...rest, search: rest.search ?? q });
    return res.json({ success: true, data, pagination });
  } catch (err) {
    return fail(err, res, next);
  }
}

// GET /api/identity/documents/:id
async function detail(req, res, next) {
  try {
    return res.json({ success: true, data: await identity.getDocumentDetail(req.params.id, req.user) });
  } catch (err) {
    return fail(err, res, next);
  }
}

// GET /api/identity/documents/:id/file  — authorised, never cached
async function file(req, res, next) {
  try {
    const { stream, contentType, document } = await identity.openDocumentFile({ documentId: req.params.id, viewer: req.user, req });
    res.set({
      "Content-Type": document.fileType || contentType || "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="document"',
    });
    stream.on("error", () => res.destroy());
    return stream.pipe(res);
  } catch (err) {
    return fail(err, res, next);
  }
}

// POST /api/identity/documents/:id/review
async function review(req, res, next) {
  try {
    const { decision, checklist, reason, assessmentNote, expiresAt } = req.body;
    const doc = await identity.reviewDocument({ documentId: req.params.id, reviewer: req.user, decision, checklist, reason, assessmentNote, expiresAt, req });
    return res.json({ success: true, data: doc, disclaimer: cfg.REVIEW_DISCLAIMER });
  } catch (err) {
    return fail(err, res, next);
  }
}

// GET /api/identity/users/:userId
async function userSummary(req, res, next) {
  try {
    return res.json({ success: true, data: await identity.getUserIdentityForStaff(req.params.userId, req.user) });
  } catch (err) {
    return fail(err, res, next);
  }
}

// POST /api/identity/users/:userId/reconcile  (admin): repair a conflicting user/document status
async function reconcile(req, res, next) {
  try {
    return res.json({ success: true, data: await identity.reconcileUser(req.params.userId, { actor: req.user }) });
  } catch (err) {
    return fail(err, res, next);
  }
}

module.exports = { me, policy, uploadMine, uploadForApplicant, withdraw, queue, detail, file, review, userSummary, reconcile };
