/**
 * Runs the identity service against a real single-node REPLICA SET so the
 * MongoDB transaction path is exercised (the other suites use a standalone
 * mongod, where the service falls back to guarded conditional updates).
 */
jest.mock("../../src/services/documentStorage", () => {
  const actual = jest.requireActual("../../src/services/documentStorage");
  return {
    ...actual,
    storePrivate: jest.fn(async () => ({ provider: "mock", publicId: `mock/${Math.random()}`, resourceType: "image", deliveryType: "authenticated" })),
    destroy: jest.fn(async () => true),
  };
});

const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../../src/models/User");
const UserDocument = require("../../src/models/UserDocument");
const IdentityVerificationRecord = require("../../src/models/IdentityVerificationRecord");
const identity = require("../../src/services/identityVerificationService");
const { JPEG } = require("../helpers/identity");

const FUTURE = new Date(Date.now() + 2 * 365 * 86400000).toISOString().slice(0, 10);
const PASS = { imageReadable: "pass", documentComplete: "pass", acceptableIdType: "pass", nameMatchesApplicant: "pass", photoConsistent: "pass", notExpired: "pass", noVisibleAlterations: "pass" };
let repl;

beforeAll(async () => {
  // tests/setup.js connected a standalone server; swap to a replica set for this file.
  await mongoose.disconnect();
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await UserDocument.init();
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await repl.stop();
  // tests/setup.js' afterAll expects an open connection to close.
  await mongoose.connect("mongodb://127.0.0.1:1/unused", { serverSelectionTimeoutMS: 1 }).catch(() => {});
});

async function newUsers() {
  const applicant = await User.create({ displayName: "Applicant", email: "a@example.com", password: "password123", emailVerified: true });
  const admin = await User.create({ displayName: "Admin", email: "adm@example.com", password: "password123", role: "admin" });
  return { applicant, admin };
}

describe("identity service on a replica set (transactions supported)", () => {
  it("is detected as transaction-capable and completes a full submit -> view -> approve flow atomically", async () => {
    const { applicant, admin } = await newUsers();
    const { document } = await identity.submitDocument({ ownerId: applicant._id, actor: applicant, file: { buffer: JPEG("tx1"), mimetype: "image/jpeg", size: 40 }, idType: "passport", expiresAt: FUTURE });
    await UserDocument.updateOne({ _id: document._id }, { $push: { reviewViews: { reviewer: admin._id } } });
    await identity.reviewDocument({ documentId: document._id, reviewer: admin, decision: "approve", checklist: PASS });

    const user = await User.findById(applicant._id);
    expect(user.identityVerificationStatus).toBe("verified");
    expect((await UserDocument.findById(document._id)).status).toBe("verified");
    expect(await IdentityVerificationRecord.countDocuments({ document: document._id })).toBe(2); // submitted + approved
  });

  it("rolls the WHOLE decision back if any step fails (document stays pending, no history row written)", async () => {
    const { applicant, admin } = await newUsers();
    const { document } = await identity.submitDocument({ ownerId: applicant._id, actor: applicant, file: { buffer: JPEG("tx2"), mimetype: "image/jpeg", size: 40 }, idType: "passport", expiresAt: FUTURE });
    await UserDocument.updateOne({ _id: document._id }, { $push: { reviewViews: { reviewer: admin._id } } });

    // Make the user-row update (step 2 of the decision) fail after the document update (step 1) succeeded.
    const spy = jest.spyOn(User, "updateOne").mockResolvedValueOnce({ matchedCount: 0 });
    await expect(identity.reviewDocument({ documentId: document._id, reviewer: admin, decision: "approve", checklist: PASS })).rejects.toMatchObject({ code: "CONFLICT" });
    spy.mockRestore();

    expect((await UserDocument.findById(document._id)).status).toBe("pending"); // rolled back
    expect((await User.findById(applicant._id)).identityVerificationStatus).toBe("pending");
    expect(await IdentityVerificationRecord.countDocuments({ document: document._id, action: "approved" })).toBe(0);

    // ...and the decision works once the fault is gone.
    await identity.reviewDocument({ documentId: document._id, reviewer: admin, decision: "approve", checklist: PASS });
    expect((await User.findById(applicant._id)).identityVerificationStatus).toBe("verified");
  });

  it("concurrent approvals still produce exactly one winner under transactions", async () => {
    const { applicant, admin } = await newUsers();
    const admin2 = await User.create({ displayName: "Admin2", email: "adm2@example.com", password: "password123", role: "admin" });
    const { document } = await identity.submitDocument({ ownerId: applicant._id, actor: applicant, file: { buffer: JPEG("tx3"), mimetype: "image/jpeg", size: 40 }, idType: "passport", expiresAt: FUTURE });
    await UserDocument.updateOne({ _id: document._id }, { $push: { reviewViews: [{ reviewer: admin._id }, { reviewer: admin2._id }] } });

    const results = await Promise.allSettled([
      identity.reviewDocument({ documentId: document._id, reviewer: admin, decision: "approve", checklist: PASS }),
      identity.reviewDocument({ documentId: document._id, reviewer: admin2, decision: "approve", checklist: PASS }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")[0].reason.statusCode).toBe(409);
    expect(await IdentityVerificationRecord.countDocuments({ document: document._id, action: "approved" })).toBe(1);
  });
});
