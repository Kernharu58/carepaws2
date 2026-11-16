const mongoose = require("mongoose");
const User = require("../../src/models/User");
const UserDocument = require("../../src/models/UserDocument");

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Minimal valid JPEG / PNG / PDF byte signatures (enough for the server's content sniffing).
const JPEG = (extra = "a") => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), Buffer.from("JFIF-test-" + extra + "-padding")]);
const PNG = (extra = "a") => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("png-test-" + extra + "-padding")]);

/**
 * Test-only: puts a user into the "verified" identity state with a genuine
 * verified government-ID document, bypassing the review flow. Writes through
 * the native collection because the User model (correctly) refuses direct
 * identity-field writes.
 */
async function markIdentityVerified(userOrEmail, { expiresAt = new Date(Date.now() + 2 * YEAR_MS) } = {}) {
  const user = typeof userOrEmail === "string" ? await User.findOne({ email: userOrEmail }) : userOrEmail;
  const reviewerId = new mongoose.Types.ObjectId();
  const doc = await UserDocument.create({
    user: user._id,
    type: "government_id",
    idType: "passport",
    status: "verified",
    verifiedBy: reviewerId,
    verifiedAt: new Date(),
    expiresAt,
    storage: { provider: "test", publicId: `test/${user._id}`, resourceType: "image", deliveryType: "authenticated" },
    fileType: "image/jpeg",
    submittedBy: user._id,
    submissionChannel: "self",
  });
  await User.collection.updateOne(
    { _id: user._id },
    { $set: { identityVerificationStatus: "verified", identityDocument: doc._id, identityVerifiedBy: reviewerId, identityVerifiedAt: new Date(), identityExpiresAt: expiresAt, identityVerificationNotes: null } }
  );
  return doc;
}

module.exports = { markIdentityVerified, JPEG, PNG };
