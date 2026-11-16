/**
 * Identity verification - backend integration tests.
 * Real Express app + real MongoDB (mongodb-memory-server). Only the Cloudinary
 * storage boundary is mocked, so no network or credentials are needed.
 */
// Redis-backed rate limiting needs a real Redis instance (see auth.flow.test.js); same mock as the other suites.
jest.mock("../../src/middleware/rateLimitMiddleware", () => ({
  globalLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  passwordResetLimiter: (req, res, next) => next(),
  resendVerificationLimiter: (req, res, next) => next(),
  resetLinkLimiter: (req, res, next) => next(),
  webhookLimiter: (req, res, next) => next(),
}));
jest.mock("../../src/services/documentStorage", () => {
  const actual = jest.requireActual("../../src/services/documentStorage");
  const { Readable } = require("stream");
  let n = 0;
  return {
    ...actual,
    storePrivate: jest.fn(async () => ({ provider: "mock", publicId: `mock/${++n}`, resourceType: "image", deliveryType: "authenticated" })),
    // Mirrors the real guard: a purged file is gone (see the direct test of the real function below).
    openStream: jest.fn(async (doc) => {
      if (doc.fileRemovedAt) throw Object.assign(new Error("The file for this document is no longer available"), { statusCode: 404 });
      return { stream: Readable.from([Buffer.from("fake-image-bytes")]), contentType: "image/jpeg" };
    }),
    destroy: jest.fn(async () => true),
  };
});

const request = require("supertest");
const { app } = require("../../src/server");
const User = require("../../src/models/User");
const Pet = require("../../src/models/Pet");
const Settings = require("../../src/models/Settings");
const Application = require("../../src/models/Application");
const UserDocument = require("../../src/models/UserDocument");
const Notification = require("../../src/models/Notification");
const IdentityVerificationRecord = require("../../src/models/IdentityVerificationRecord");
const storage = require("../../src/services/documentStorage");
const identity = require("../../src/services/identityVerificationService");
const { markIdentityVerified, JPEG, PNG } = require("../helpers/identity");

const FUTURE = new Date(Date.now() + 2 * 365 * 86400000).toISOString().slice(0, 10);
const PASS = { imageReadable: "pass", documentComplete: "pass", acceptableIdType: "pass", nameMatchesApplicant: "pass", photoConsistent: "pass", notExpired: "pass", noVisibleAlterations: "pass" };

async function makeUser(email, role = "user") {
  await request(app).post("/api/auth/register").send({ acceptedTerms: true, displayName: `Test ${role}`, email, password: "password123" });
  await User.updateOne({ email }, { emailVerified: true, ...(role !== "user" ? { role } : {}) });
  const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return { token: login.body.data.accessToken, id: login.body.data.user.id, email };
}
const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const upload = (u, { idType = "passport", expires = FUTURE, buf = JPEG("1"), mime = "image/jpeg" } = {}) => {
  const r = request(app).post("/api/identity/documents").set(auth(u)).field("idType", idType);
  if (expires) r.field("expiresAt", expires);
  return r.attach("file", buf, { filename: "id", contentType: mime });
};
const viewFile = (u, docId) => request(app).get(`/api/identity/documents/${docId}/file`).set(auth(u));
const review = (u, docId, body) => request(app).post(`/api/identity/documents/${docId}/review`).set(auth(u)).send(body);
const approve = (u, docId, extra = {}) => review(u, docId, { decision: "approve", checklist: PASS, ...extra });
// A reviewer must actually open the image before approving.
const viewThenApprove = async (u, docId, extra) => {
  await viewFile(u, docId);
  return approve(u, docId, extra);
};
const apply = (u, pet, extra = {}) => request(app).post("/api/applications").set(auth(u)).send({ pet: pet._id.toString(), phone: "0917000000", address: "123 Main St", ...extra });

let applicant, admin, admin2, staff, other;

beforeEach(async () => {
  storage.storePrivate.mockClear();
  storage.destroy.mockClear();
  applicant = await makeUser("applicant@example.com");
  other = await makeUser("other@example.com");
  admin = await makeUser("admin@example.com", "admin");
  admin2 = await makeUser("admin2@example.com", "admin");
  staff = await makeUser("staff@example.com", "staff");
});

const newPet = (name = "Bantay") => Pet.create({ name, species: "Dog", status: "Available" });

describe("application eligibility (identity checked server-side)", () => {
  it("blocks an unverified applicant from submitting an ADOPTION application", async () => {
    const res = await apply(applicant, await newPet());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("IDENTITY_NOT_VERIFIED");
    expect(res.body.identityStatus).toBe("unverified");
    expect(await Application.countDocuments()).toBe(0);
  });

  it("blocks an unverified applicant from submitting a FOSTER application", async () => {
    const res = await apply(applicant, await newPet(), { type: "foster" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("IDENTITY_NOT_VERIFIED");
  });

  it("explains pending / rejected / expired states with clear messages", async () => {
    const up = await upload(applicant);
    expect(up.status).toBe(201);
    let res = await apply(applicant, await newPet());
    expect(res.body.identityStatus).toBe("pending");
    expect(res.body.message).toMatch(/waiting for staff review/i);

    await viewFile(admin, up.body.data._id);
    await review(admin, up.body.data._id, { decision: "reject", reason: "Photo is blurry and unreadable" });
    res = await apply(applicant, await newPet("Luna"));
    expect(res.body.identityStatus).toBe("rejected");
    expect(res.body.message).toMatch(/blurry/);
  });

  it("lets a verified applicant submit BOTH adoption and foster using the SAME identity record", async () => {
    const doc = await markIdentityVerified(applicant.email);
    const adopt = await apply(applicant, await newPet("A"));
    const foster = await apply(applicant, await newPet("B"), { type: "foster" });
    expect(adopt.status).toBe(201);
    expect(foster.status).toBe(201);
    const apps = await Application.find({ applicant: applicant.id });
    expect(apps.map((a) => String(a.identityCheck.document))).toEqual([String(doc._id), String(doc._id)]);
    expect(await UserDocument.countDocuments({ user: applicant.id, type: "government_id" })).toBe(1);
  });

  it("does not trust a client-supplied identity status or applicant id", async () => {
    const res = await apply(applicant, await newPet(), { identityVerificationStatus: "verified", applicant: other.id });
    // identity fields are not part of the application schema (.strict) -> rejected, or ignored and still blocked
    expect([400, 403]).toContain(res.status);
    expect(await Application.countDocuments()).toBe(0);
  });

  it("holds staff-created (walk-in) applications to the same identity rule - no silent bypass", async () => {
    const pet = await newPet();
    const blocked = await request(app).post("/api/applications").set(auth(staff)).send({ pet: pet._id.toString(), applicant: applicant.id, phone: "0917000000", address: "123 Main St" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("IDENTITY_NOT_VERIFIED");
    expect(blocked.body.message).toMatch(/applicant/i);

    await markIdentityVerified(applicant.email);
    const ok = await request(app).post("/api/applications").set(auth(staff)).send({ pet: pet._id.toString(), applicant: applicant.id, phone: "0917000000", address: "123 Main St" });
    expect(ok.status).toBe(201);
    expect(String(ok.body.data.applicant._id || ok.body.data.applicant)).toBe(applicant.id);
  });

  it("keeps email verification independent: verified email does not imply identity, and vice versa", async () => {
    const me = await request(app).get("/api/identity/me").set(auth(applicant));
    expect(me.body.data.emailVerified).toBe(true);
    expect(me.body.data.status).toBe("unverified");

    const emailLess = await makeUser("noemail@example.com");
    await User.updateOne({ _id: emailLess.id }, { emailVerified: false });
    await markIdentityVerified("noemail@example.com");
    const res = await apply(emailLess, await newPet());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });
});

describe("approving identity", () => {
  it("cannot verify an account that has no ID: legacy direct-set endpoint is retired", async () => {
    const res = await request(app).put(`/api/auth/users/${applicant.id}/verification`).set(auth(admin)).send({ identityVerificationStatus: "verified" });
    expect(res.status).toBe(410);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("unverified");
  });

  it("cannot approve without a document: unknown document -> 404, document with its file gone -> 409", async () => {
    const missing = await review(admin, "64b64b64b64b64b64b64b64b", { decision: "approve", checklist: PASS });
    expect(missing.status).toBe(404);

    const up = await upload(applicant);
    await viewFile(admin, up.body.data._id);
    await UserDocument.updateOne({ _id: up.body.data._id }, { fileRemovedAt: new Date() });
    const res = await approve(admin, up.body.data._id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NO_DOCUMENT_FILE");
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("pending");
  });

  it("requires the reviewer to have actually opened the image", async () => {
    const up = await upload(applicant);
    const res = await approve(admin, up.body.data._id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DOCUMENT_NOT_VIEWED");
  });

  it("requires a complete, fully-passing checklist", async () => {
    const up = await upload(applicant);
    await viewFile(admin, up.body.data._id);
    const incomplete = await review(admin, up.body.data._id, { decision: "approve", checklist: { imageReadable: "pass" } });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.code).toBe("CHECKLIST_INCOMPLETE");
    const failing = await approve(admin, up.body.data._id, { checklist: { ...PASS, noVisibleAlterations: "fail" } });
    expect(failing.status).toBe(400);
    expect(failing.body.code).toBe("CHECKLIST_FAILED");
    expect((await UserDocument.findById(up.body.data._id)).status).toBe("pending");
  });

  it("approves a valid uploaded ID: document + user in sync, reviewer/time/decision recorded, applicant notified, applying now works", async () => {
    const up = await upload(applicant, { idType: "drivers_license" });
    expect(up.status).toBe(201);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("pending");

    const res = await viewThenApprove(admin, up.body.data._id, { assessmentNote: "Checked at desk" });
    expect(res.status).toBe(200);
    expect(res.body.disclaimer).toMatch(/not forensic authentication/i);

    const doc = await UserDocument.findById(up.body.data._id);
    const user = await User.findById(applicant.id);
    expect(doc.status).toBe("verified");
    expect(String(doc.verifiedBy)).toBe(admin.id);
    expect(doc.verifiedAt).toBeInstanceOf(Date);
    expect(user.identityVerificationStatus).toBe("verified");
    expect(String(user.identityDocument)).toBe(String(doc._id));
    expect(String(user.identityVerifiedBy)).toBe(admin.id);

    const record = await IdentityVerificationRecord.findOne({ document: doc._id, action: "approved" });
    expect(String(record.actor)).toBe(admin.id);
    expect(record.toStatus).toBe("verified");
    expect(record.assessmentType).toBe("staff_visual_review");
    expect(record.checklist.nameMatchesApplicant).toBe("pass");
    expect(await Notification.countDocuments({ recipient: applicant.id, type: "IDENTITY_VERIFIED" })).toBe(1);

    expect((await apply(applicant, await newPet())).status).toBe(201);
  });

  it("rejects approving an ID that is already expired / reviewer-confirmed expiry in the past", async () => {
    const up = await upload(applicant);
    await viewFile(admin, up.body.data._id);
    const res = await approve(admin, up.body.data._id, { expiresAt: "2020-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DOCUMENT_EXPIRED");
  });
});

describe("authorization", () => {
  it("applicant, staff and anonymous callers cannot approve identity", async () => {
    const up = await upload(applicant);
    const docId = up.body.data._id;
    expect((await review(applicant, docId, { decision: "approve", checklist: PASS })).status).toBe(403);
    expect((await review(staff, docId, { decision: "approve", checklist: PASS })).status).toBe(403);
    expect((await request(app).post(`/api/identity/documents/${docId}/review`).send({ decision: "approve", checklist: PASS })).status).toBe(401);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("pending");
  });

  it("an admin cannot review their own ID", async () => {
    const up = await upload(admin);
    await viewFile(admin2, up.body.data._id); // another admin looks, but...
    const res = await review(admin, up.body.data._id, { decision: "approve", checklist: PASS });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("SELF_REVIEW");
  });

  it("an applicant cannot read another applicant's ID; staff without reviewer rights cannot either", async () => {
    const up = await upload(applicant);
    const docId = up.body.data._id;
    expect((await viewFile(other, docId)).status).toBe(403);
    expect((await viewFile(staff, docId)).status).toBe(403);
    expect((await request(app).get(`/api/identity/documents/${docId}/file`)).status).toBe(401);
    expect((await viewFile(applicant, docId)).status).toBe(200); // the owner can
    const reviewerView = await viewFile(admin, docId);
    expect(reviewerView.status).toBe(200);
    expect(reviewerView.headers["cache-control"]).toMatch(/no-store/);
  });

  it("an applicant cannot see another applicant's ID through the generic document list/endpoints", async () => {
    const up = await upload(applicant);
    expect((await request(app).get(`/api/documents/${up.body.data._id}/file`).set(auth(other))).status).toBe(403);
    expect((await request(app).get("/api/documents").set(auth(other))).status).toBe(403);
    // staff list of application documents never includes government IDs
    const list = await request(app).get("/api/documents").set(auth(staff));
    expect(list.body.data.some((d) => d.type === "government_id")).toBe(false);
    // detail/queue are reviewer-only
    expect((await request(app).get(`/api/identity/documents/${up.body.data._id}`).set(auth(other))).status).toBe(403);
    expect((await request(app).get("/api/identity/queue").set(auth(staff))).status).toBe(403);
  });

  it("never exposes file URLs or storage details in any API response", async () => {
    const up = await upload(applicant);
    const bodies = [
      up.body,
      (await request(app).get("/api/identity/me").set(auth(applicant))).body,
      (await request(app).get("/api/documents/my").set(auth(applicant))).body,
      (await request(app).get("/api/identity/queue").set(auth(admin))).body,
      (await request(app).get(`/api/identity/documents/${up.body.data._id}`).set(auth(admin))).body,
    ];
    for (const b of bodies) {
      const text = JSON.stringify(b);
      expect(text).not.toMatch(/fileUrl|publicId|"storage"|contentHash|res\.cloudinary/);
    }
  });

  it("staff can upload an ID for a walk-in, but a different admin must review it", async () => {
    const up = await request(app).post(`/api/identity/walk-in/${applicant.id}/documents`).set(auth(staff)).field("idType", "national_id").attach("file", JPEG("walkin"), { filename: "id", contentType: "image/jpeg" });
    expect(up.status).toBe(201);
    const record = await IdentityVerificationRecord.findOne({ document: up.body.data._id });
    expect(record.action).toBe("staff_assisted_submission");
    expect(String(record.actor)).toBe(staff.id);
    expect((await UserDocument.findById(up.body.data._id)).submissionChannel).toBe("staff_assisted");
    expect(await Notification.countDocuments({ recipient: applicant.id, type: "IDENTITY_SUBMITTED" })).toBe(1);
    // a plain applicant cannot use the walk-in route for someone else
    const denied = await request(app).post(`/api/identity/walk-in/${other.id}/documents`).set(auth(applicant)).field("idType", "national_id").attach("file", JPEG("x2"), { filename: "id", contentType: "image/jpeg" });
    expect(denied.status).toBe(403);
    // staff cannot approve it (no reviewer rights)
    expect((await review(staff, up.body.data._id, { decision: "approve", checklist: PASS })).status).toBe(403);
    // an admin who uploaded on someone's behalf cannot review their own upload
    const adminUp = await request(app).post(`/api/identity/walk-in/${other.id}/documents`).set(auth(admin)).field("idType", "national_id").attach("file", JPEG("adm"), { filename: "id", contentType: "image/jpeg" });
    await viewFile(admin, adminUp.body.data._id);
    const selfSubmitted = await approve(admin, adminUp.body.data._id);
    expect(selfSubmitted.status).toBe(403);
    expect(selfSubmitted.body.code).toBe("SUBMITTER_CANNOT_REVIEW");
    // a second admin completes the walk-in verification
    expect((await viewThenApprove(admin2, adminUp.body.data._id)).status).toBe(200);
    expect((await User.findById(other.id)).identityVerificationStatus).toBe("verified");
  });
});

describe("government ID document management", () => {
  it("validates ID type, expiry, and real file content", async () => {
    expect((await upload(applicant, { idType: "library_card" })).status).toBe(400);
    const noExpiry = await upload(applicant, { expires: null });
    expect(noExpiry.status).toBe(400);
    expect(noExpiry.body.code).toBe("EXPIRY_REQUIRED");
    const past = await upload(applicant, { expires: "2020-01-01" });
    expect(past.status).toBe(400);
    expect(past.body.code).toBe("DOCUMENT_EXPIRED");
    const fake = await upload(applicant, { buf: Buffer.from("this is not an image at all, sorry") });
    expect(fake.status).toBe(400);
    expect(fake.body.code).toBe("FILE_TYPE_MISMATCH");
    // a National ID may have no expiry
    expect((await upload(applicant, { idType: "national_id", expires: null })).status).toBe(201);
    expect(storage.storePrivate).toHaveBeenCalledTimes(1); // invalid uploads never reach storage
  });

  it("rejects a second upload while one is pending, including concurrent double-submits", async () => {
    const [a, b] = await Promise.all([upload(applicant, { buf: JPEG("c1") }), upload(applicant, { buf: JPEG("c2") })]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await UserDocument.countDocuments({ user: applicant.id, type: "government_id", status: "pending" })).toBe(1);
    const again = await upload(applicant, { buf: JPEG("c3") });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("DUPLICATE_PENDING");
  });

  it("protects a verified ID from deletion and keeps history", async () => {
    const up = await upload(applicant);
    await viewThenApprove(admin, up.body.data._id);
    const del = await request(app).delete(`/api/identity/documents/${up.body.data._id}`).set(auth(applicant));
    expect(del.status).toBe(409);
    expect(del.body.code).toBe("VERIFIED_ID_PROTECTED");
    const viaOld = await request(app).delete(`/api/documents/${up.body.data._id}`).set(auth(applicant));
    expect(viaOld.status).toBe(409);
    expect(await UserDocument.findById(up.body.data._id)).not.toBeNull();
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("verified");
    expect(storage.destroy).not.toHaveBeenCalled();
    // someone else's delete is indistinguishable from "not found"
    expect((await request(app).delete(`/api/identity/documents/${up.body.data._id}`).set(auth(other))).status).toBe(404);
  });

  it("withdrawing a pending ID returns the applicant to unverified but keeps the record", async () => {
    const up = await upload(applicant);
    const del = await request(app).delete(`/api/identity/documents/${up.body.data._id}`).set(auth(applicant));
    expect(del.status).toBe(200);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("unverified");
    const doc = await UserDocument.findById(up.body.data._id);
    expect(doc.status).toBe("withdrawn");
    expect(doc.fileRemovedAt).toBeInstanceOf(Date);
    expect(await IdentityVerificationRecord.countDocuments({ document: doc._id, action: "withdrawn" })).toBe(1);
    expect(storage.destroy).toHaveBeenCalledTimes(1);
    expect((await upload(applicant, { buf: JPEG("again") })).status).toBe(201); // can start over
  });

  it("rejection requires a reason; resubmission is controlled; the same rejected image cannot be re-sent", async () => {
    const up = await upload(applicant, { buf: JPEG("bad") });
    const docId = up.body.data._id;
    await viewFile(admin, docId);
    for (const body of [{ decision: "reject" }, { decision: "reject", reason: "no" }, { decision: "request_resubmission", reason: "   " }]) {
      const res = await review(admin, docId, body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("REASON_REQUIRED");
    }
    expect((await UserDocument.findById(docId)).status).toBe("pending");

    const rejected = await review(admin, docId, { decision: "reject", reason: "ID is cropped; edges are missing" });
    expect(rejected.status).toBe(200);
    let user = await User.findById(applicant.id);
    expect(user.identityVerificationStatus).toBe("rejected");
    expect(user.identityVerificationNotes).toMatch(/cropped/);
    expect(await Notification.countDocuments({ recipient: applicant.id, type: "IDENTITY_REJECTED" })).toBe(1);

    const same = await upload(applicant, { buf: JPEG("bad") });
    expect(same.status).toBe(409);
    expect(same.body.code).toBe("DUPLICATE_FILE");

    const fresh = await upload(applicant, { buf: PNG("better"), mime: "image/png" });
    expect(fresh.status).toBe(201);
    user = await User.findById(applicant.id);
    expect(user.identityVerificationStatus).toBe("pending");
    expect(String(user.identityDocument)).toBe(fresh.body.data._id);
    // the first (rejected) record is preserved as history
    const old = await UserDocument.findById(docId);
    expect(old.status).toBe("rejected");
    expect(String(old.supersededBy)).toBe(fresh.body.data._id);

    expect((await viewThenApprove(admin, fresh.body.data._id)).status).toBe(200);
  });

  it("request_resubmission sets resubmission_required and notifies the applicant", async () => {
    const up = await upload(applicant);
    await viewFile(admin, up.body.data._id);
    const res = await review(admin, up.body.data._id, { decision: "request_resubmission", reason: "Please retake in better light" });
    expect(res.status).toBe(200);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("resubmission_required");
    expect(await Notification.countDocuments({ recipient: applicant.id, type: "IDENTITY_RESUBMISSION_REQUIRED" })).toBe(1);
    expect((await upload(applicant, { buf: JPEG("retake") })).status).toBe(201);
  });

  it("an expired ID expires the identity and can be replaced; the old verified record is kept as superseded history", async () => {
    const up = await upload(applicant, { buf: JPEG("old") });
    await viewThenApprove(admin, up.body.data._id);
    const oldId = up.body.data._id;
    // Already verified and far from expiry: replacement is refused.
    const early = await upload(applicant, { buf: JPEG("early") });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("ALREADY_VERIFIED");

    await UserDocument.updateOne({ _id: oldId }, { expiresAt: new Date(Date.now() - 1000) });
    expect(await identity.expireDueIdentities()).toBe(1);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("expired");
    expect(await Notification.countDocuments({ recipient: applicant.id, type: "IDENTITY_EXPIRED" })).toBe(1);
    expect((await apply(applicant, await newPet())).body.identityStatus).toBe("expired");
    // running the job again is a no-op
    expect(await identity.expireDueIdentities()).toBe(0);

    const fresh = await upload(applicant, { buf: JPEG("new") });
    expect(fresh.status).toBe(201);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("pending");
    expect((await viewThenApprove(admin, fresh.body.data._id)).status).toBe(200);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("verified");

    const actions = (await IdentityVerificationRecord.find({ user: applicant.id }).sort({ createdAt: 1 })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["submitted", "approved", "expired", "approved"]));
    expect(await UserDocument.countDocuments({ user: applicant.id, type: "government_id" })).toBe(2);
  });

  it("a verified ID close to expiry can be renewed without losing verified status until the new one is approved", async () => {
    const up = await upload(applicant, { buf: JPEG("r1"), expires: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) });
    await viewThenApprove(admin, up.body.data._id, { expiresAt: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) });
    const renewal = await upload(applicant, { buf: JPEG("r2") });
    expect(renewal.status).toBe(201);
    expect(renewal.body.renewal).toBe(true);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("verified"); // still verified
    expect((await apply(applicant, await newPet())).status).toBe(201);

    expect((await viewThenApprove(admin, renewal.body.data._id)).status).toBe(200);
    expect((await UserDocument.findById(up.body.data._id)).status).toBe("superseded");
    expect(String((await User.findById(applicant.id)).identityDocument)).toBe(renewal.body.data._id);
  });
});

describe("status integrity", () => {
  it("validates identity status transitions on the backend", () => {
    const bad = [["unverified", "verified"], ["unverified", "rejected"], ["rejected", "verified"], ["resubmission_required", "verified"], ["expired", "verified"], ["verified", "pending"], ["verified", "unverified"], ["pending", "expired"]];
    for (const [from, to] of bad) expect(() => identity.assertIdentityTransition(from, to)).toThrow(/cannot change/);
    const good = [["unverified", "pending"], ["pending", "verified"], ["pending", "rejected"], ["pending", "resubmission_required"], ["verified", "expired"], ["rejected", "pending"], ["expired", "pending"]];
    for (const [from, to] of good) expect(() => identity.assertIdentityTransition(from, to)).not.toThrow();
  });

  it("an already-decided document cannot be decided again", async () => {
    const up = await upload(applicant);
    await review(admin, up.body.data._id, { decision: "reject", reason: "Not an accepted ID type" });
    const res = await approve(admin, up.body.data._id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_REVIEWED");
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("rejected");
  });

  it("refuses to change identity fields through the User model directly", async () => {
    const user = await User.findById(applicant.id);
    user.identityVerificationStatus = "verified";
    await expect(user.save()).rejects.toThrow(/identity verification service/);
    await expect(User.updateOne({ _id: applicant.id }, { identityVerificationStatus: "verified" })).rejects.toThrow(/identity verification service/);
    await expect(User.findOneAndUpdate({ _id: applicant.id }, { $set: { identityVerificationStatus: "verified" } })).rejects.toThrow(/identity verification service/);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("unverified");
    // a new account can never be created pre-verified
    const created = await User.create({ displayName: "Sneaky", email: "sneaky@example.com", password: "password123", identityVerificationStatus: "verified" });
    expect(created.identityVerificationStatus).toBe("unverified");
  });

  it("a user row claiming 'verified' with no document does not grant access, and reconcile repairs it", async () => {
    await User.collection.updateOne({ _id: new (require("mongoose").Types.ObjectId)(applicant.id) }, { $set: { identityVerificationStatus: "verified" } });
    const res = await apply(applicant, await newPet());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("IDENTITY_NOT_VERIFIED");
    const fixed = await request(app).post(`/api/identity/users/${applicant.id}/reconcile`).set(auth(admin));
    expect(fixed.status).toBe(200);
    expect(fixed.body.data.changed).toBe(true);
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("resubmission_required");
    expect(await IdentityVerificationRecord.countDocuments({ user: applicant.id, action: "status_reconciled" })).toBe(1);
  });

  it("a user row claiming 'verified' while the document is rejected is not eligible, and reconcile follows the document", async () => {
    const doc = await markIdentityVerified(applicant.email);
    await UserDocument.updateOne({ _id: doc._id }, { status: "rejected" });
    expect((await apply(applicant, await newPet())).status).toBe(403);
    const result = await identity.reconcileUser(applicant.id);
    expect(result).toMatchObject({ changed: true, from: "verified", to: "rejected" });
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("rejected");
  });

  it("a verified document belonging to a different user cannot be borrowed", async () => {
    const doc = await markIdentityVerified(other.email);
    await User.collection.updateOne({ _id: new (require("mongoose").Types.ObjectId)(applicant.id) }, { $set: { identityVerificationStatus: "verified", identityDocument: doc._id } });
    const res = await apply(applicant, await newPet());
    expect(res.status).toBe(403);
  });

  it("only one of two simultaneous decisions can win (approve vs approve, approve vs reject)", async () => {
    let up = await upload(applicant, { buf: JPEG("conc1") });
    await viewFile(admin, up.body.data._id);
    await viewFile(admin2, up.body.data._id);
    const [a, b] = await Promise.all([approve(admin, up.body.data._id), approve(admin2, up.body.data._id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await IdentityVerificationRecord.countDocuments({ document: up.body.data._id, action: "approved" })).toBe(1);

    up = await upload(other, { buf: JPEG("conc2") });
    await viewFile(admin, up.body.data._id);
    await viewFile(admin2, up.body.data._id);
    const [c, d] = await Promise.all([approve(admin, up.body.data._id), review(admin2, up.body.data._id, { decision: "reject", reason: "Looks altered near the date" })]);
    expect([c.status, d.status].sort()).toEqual([200, 409]);
    const finalDoc = await UserDocument.findById(up.body.data._id);
    const finalUser = await User.findById(other.id);
    expect(finalUser.identityVerificationStatus).toBe(finalDoc.status); // never out of sync
    expect(["verified", "rejected"]).toContain(finalDoc.status);
  });
});

describe("pipeline stages and policy", () => {
  it("re-checks identity when advancing stages: an expired ID blocks advancing but never blocks rejecting", async () => {
    const doc = await markIdentityVerified(applicant.email);
    const created = await apply(applicant, await newPet());
    expect(created.status).toBe(201);
    const appId = created.body.data._id;

    await UserDocument.updateOne({ _id: doc._id }, { expiresAt: new Date(Date.now() - 1000) });
    await identity.expireDueIdentities();

    const blocked = await request(app).put(`/api/applications/${appId}/stage`).set(auth(staff)).send({ stage: "document_review" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("IDENTITY_NOT_VERIFIED");
    expect((await Application.findById(appId)).stage).toBe("submitted");

    // Final decision stage (the existing pipeline only allows decisions from risk_assessment).
    await Application.updateOne({ _id: appId }, { stage: "risk_assessment" });
    const approveBlocked = await request(app).put(`/api/applications/${appId}/status`).set(auth(staff)).send({ status: "approved" });
    expect(approveBlocked.status).toBe(409);
    expect(approveBlocked.body.code).toBe("IDENTITY_NOT_VERIFIED");
    expect((await Application.findById(appId)).status).toBe("pending");
    // Rejecting never requires a verified identity.
    const reject = await request(app).put(`/api/applications/${appId}/status`).set(auth(staff)).send({ status: "rejected" });
    expect(reject.status).toBe(200);
    expect((await Application.findById(appId)).status).toBe("rejected");
  });

  it("before_review policy lets an unverified applicant submit but not advance; admin can change the policy, staff cannot", async () => {
    expect((await request(app).put("/api/settings/identity-policy").set(auth(staff)).send({ adoption: "before_review" })).status).toBe(403);
    expect((await request(app).put("/api/settings/identity-policy").set(auth(applicant)).send({ adoption: "none" })).status).toBe(403);
    const set = await request(app).put("/api/settings/identity-policy").set(auth(admin)).send({ adoption: "before_review" });
    expect(set.status).toBe(200);
    // the generic settings endpoint can no longer be used to weaken the policy
    await request(app).put("/api/settings").set(auth(staff)).send({ identityPolicy: { adoption: "none", foster: "none" } });
    expect((await Settings.findOne()).identityPolicy.adoption).toBe("before_review");
    expect((await Settings.findOne()).identityPolicy.foster).toBe("before_submission");

    const created = await apply(applicant, await newPet());
    expect(created.status).toBe(201);
    const blocked = await request(app).put(`/api/applications/${created.body.data._id}/stage`).set(auth(staff)).send({ stage: "document_review" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("IDENTITY_NOT_VERIFIED");
    // foster policy is independent and still strict
    expect((await apply(applicant, await newPet("F"), { type: "foster" })).status).toBe(403);
  });

  it("a government ID is not an application document (the interview check ignores it)", async () => {
    const doc = await markIdentityVerified(applicant.email);
    expect(doc.application).toBeNull();
    const up = await upload(other);
    expect((await UserDocument.findById(up.body.data._id)).application).toBeNull();
    // generic upload endpoint refuses government IDs
    const viaOld = await request(app).post("/api/documents").set(auth(other)).field("type", "government_id").attach("file", JPEG("old"), { filename: "id", contentType: "image/jpeg" });
    expect(viaOld.status).toBe(400);
    expect(viaOld.body.code).toBe("USE_IDENTITY_ENDPOINT");
    // and the application-document reviewer refuses to review one
    const verify = await request(app).put(`/api/documents/${doc._id}/verify`).set(auth(admin)).send({ status: "verified" });
    expect(verify.status).toBe(400);
    expect(verify.body.code).toBe("USE_IDENTITY_REVIEW");
  });
});

describe("history, queue and retention", () => {
  it("queue lists pending IDs oldest-first with applicant info; detail shows history, checklist and the staff-assessment disclaimer", async () => {
    const a = await upload(applicant, { buf: JPEG("q1") });
    const b = await upload(other, { buf: JPEG("q2") });
    const queue = await request(app).get("/api/identity/queue").set(auth(admin));
    expect(queue.status).toBe(200);
    expect(queue.body.data.map((d) => d._id)).toEqual([a.body.data._id, b.body.data._id]);
    expect(queue.body.data[0].user.displayName).toBeDefined();
    expect(queue.body.data[0].idType).toBe("passport");

    await viewFile(admin, a.body.data._id);
    await review(admin, a.body.data._id, { decision: "reject", reason: "Name does not match account" });
    const detail = await request(app).get(`/api/identity/documents/${a.body.data._id}`).set(auth(admin));
    expect(detail.body.data.disclaimer).toMatch(/not forensic authentication/i);
    expect(detail.body.data.checklist).toHaveLength(7);
    const actions = detail.body.data.history.map((h) => h.action);
    expect(actions).toEqual(expect.arrayContaining(["submitted", "rejected"]));
    const rejectedEntry = detail.body.data.history.find((h) => h.action === "rejected");
    expect(rejectedEntry.actor.displayName).toBeDefined();
    expect(rejectedEntry.reason).toMatch(/Name does not match/);
    expect(rejectedEntry.createdAt).toBeDefined();
    // the applicant's view hides reviewer identity
    const mine = await request(app).get("/api/identity/me").set(auth(applicant));
    expect(mine.body.data.status).toBe("rejected");
    expect(mine.body.data.reason).toMatch(/Name does not match/);
    expect(JSON.stringify(mine.body.data.history)).not.toMatch(/actor|displayName/);
  });

  it("flags when the exact same image was submitted by another account", async () => {
    await upload(applicant, { buf: JPEG("shared") });
    const second = await upload(other, { buf: JPEG("shared") });
    const detail = await request(app).get(`/api/identity/documents/${second.body.data._id}`).set(auth(admin));
    expect(detail.body.data.warnings[0]).toMatch(/other account/);
  });

  it("the real storage layer refuses to serve a file whose image was purged (no network needed)", async () => {
    const real = jest.requireActual("../../src/services/documentStorage");
    await expect(real.openStream({ fileRemovedAt: new Date(), storage: { publicId: "x" } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(real.openStream({})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("the history log is append-only", async () => {
    await upload(applicant);
    const record = await IdentityVerificationRecord.findOne({ user: applicant.id });
    record.reason = "tampered";
    await expect(record.save()).rejects.toThrow(/append-only/);
    await expect(IdentityVerificationRecord.deleteMany({ user: applicant.id })).rejects.toThrow(/append-only/);
  });

  it("retention deletes the stored image after the retention period but keeps the verification record and status", async () => {
    const up = await upload(applicant);
    await viewThenApprove(admin, up.body.data._id);
    expect(await identity.purgeStaleImages()).toBe(0); // retention not yet reached
    await UserDocument.updateOne({ _id: up.body.data._id }, { imageDeleteAfter: new Date(Date.now() - 1000) });
    expect(await identity.purgeStaleImages()).toBe(1);
    const doc = await UserDocument.findById(up.body.data._id);
    expect(doc.fileRemovedAt).toBeInstanceOf(Date);
    expect(doc.status).toBe("verified");
    expect((await User.findById(applicant.id)).identityVerificationStatus).toBe("verified");
    expect(storage.destroy).toHaveBeenCalled();
    expect((await viewFile(admin, up.body.data._id)).status).toBe(404);
    expect(await IdentityVerificationRecord.countDocuments({ document: doc._id, action: "image_purged" })).toBe(1);
    // pending IDs are never purged
    const pend = await upload(other, { buf: JPEG("pend") });
    await UserDocument.updateOne({ _id: pend.body.data._id }, { imageDeleteAfter: new Date(Date.now() - 1000) });
    expect(await identity.purgeStaleImages()).toBe(0);
  });
});
