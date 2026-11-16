const mongoose = require("mongoose");
const User = require("../../src/models/User");
const UserDocument = require("../../src/models/UserDocument");
const IdentityVerificationRecord = require("../../src/models/IdentityVerificationRecord");
const { migrate } = require("../../scripts/migrate-identity-verification");

const raw = (id) => new mongoose.Types.ObjectId(id);
// Legacy rows are inserted natively to mimic data written by the OLD code (bypassing today's guards).
async function legacyUser(email, status) {
  const u = await User.create({ displayName: "Legacy", email, password: "password123" });
  await User.collection.updateOne({ _id: u._id }, { $set: { identityVerificationStatus: status } });
  return u;
}
const legacyDoc = (userId, fields = {}) =>
  UserDocument.collection.insertOne({ user: raw(userId), type: "government_id", fileUrl: "https://res.cloudinary.com/demo/image/upload/v1/carepaws/documents/x.jpg", status: "pending", createdAt: new Date(), updatedAt: new Date(), ...fields });

describe("migration to the centralized identity model", () => {
  it("dry run changes nothing; apply links, reconciles, unlinks applications and is idempotent", async () => {
    await UserDocument.init();
    // A pre-migration database has no "one pending ID per user" index; the migration must create it.
    await UserDocument.collection.dropIndex("one_pending_government_id_per_user");
    const verifiedOk = await legacyUser("ok@example.com", "verified");
    const verifiedNoDoc = await legacyUser("nodoc@example.com", "verified");
    const pendingTwice = await legacyUser("twice@example.com", "pending");
    const rejected = await legacyUser("rej@example.com", "rejected");
    const appId = new mongoose.Types.ObjectId();

    const okDoc = await legacyDoc(verifiedOk._id, { status: "verified", verifiedBy: new mongoose.Types.ObjectId(), verifiedAt: new Date(), application: appId });
    await legacyDoc(pendingTwice._id, { status: "pending", createdAt: new Date(Date.now() - 5000) });
    const newestPending = await legacyDoc(pendingTwice._id, { status: "pending", createdAt: new Date() });
    await legacyDoc(rejected._id, { status: "rejected", rejectedReason: "blurry" });

    const dry = await migrate({ apply: false });
    expect(dry).toMatchObject({ unlinkedFromApplications: 1, pendingDeduplicated: 1, verifiedWithoutDocument: 1 });
    expect((await User.findById(verifiedNoDoc._id)).identityVerificationStatus).toBe("verified"); // untouched
    expect(await UserDocument.countDocuments({ status: "pending" })).toBe(2);

    const applied = await migrate({ apply: true });
    expect(applied.usersLinked).toBeGreaterThanOrEqual(3);

    // verified with a genuinely reviewed document stays verified and is now linked
    const ok = await User.findById(verifiedOk._id);
    expect(ok.identityVerificationStatus).toBe("verified");
    expect(String(ok.identityDocument)).toBe(String(okDoc.insertedId));
    expect((await UserDocument.findById(okDoc.insertedId)).application).toBeNull();
    // verified on a bare flag -> not verified any more
    const nodoc = await User.findById(verifiedNoDoc._id);
    expect(nodoc.identityVerificationStatus).toBe("resubmission_required");
    expect(nodoc.identityVerificationNotes).toMatch(/upload it again/i);
    // duplicates resolved, newest pending kept and linked
    expect(await UserDocument.countDocuments({ user: pendingTwice._id, status: "pending" })).toBe(1);
    expect(String((await User.findById(pendingTwice._id)).identityDocument)).toBe(String(newestPending.insertedId));
    expect((await User.findById(rejected._id)).identityVerificationStatus).toBe("rejected");
    // history is written, retention set on decided documents
    expect(await IdentityVerificationRecord.countDocuments({ action: "legacy_migrated" })).toBe(3);
    expect((await UserDocument.findById(okDoc.insertedId)).imageDeleteAfter).toBeInstanceOf(Date);

    // the unique index exists again and now enforces the rule
    const indexes = await UserDocument.collection.indexes();
    expect(indexes.some((i) => i.name === "one_pending_government_id_per_user" && i.unique)).toBe(true);
    await expect(legacyDoc(pendingTwice._id, { status: "pending" })).rejects.toThrow(/E11000/);

    // idempotent
    const again = await migrate({ apply: true });
    expect(again).toMatchObject({ unlinkedFromApplications: 0, pendingDeduplicated: 0, usersLinked: 0, usersReconciled: 0, historyRecords: 0, retentionSet: 0 });
  });
});
