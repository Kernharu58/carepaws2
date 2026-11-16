#!/usr/bin/env node
/**
 * One-off migration to the centralized identity-verification model.
 * NOT run automatically. Safe to re-run (idempotent). Dry run by default.
 *
 *   node scripts/migrate-identity-verification.js                      # dry run: counts only
 *   node scripts/migrate-identity-verification.js --apply              # write changes
 *   node scripts/migrate-identity-verification.js --apply --move-files # also move legacy PUBLIC
 *                                                                      # Cloudinary files to private delivery
 *
 * Run it BEFORE (or right after) deploying the new server and restart afterwards:
 * the new unique index "one pending government ID per user" cannot build while
 * a user still has two pending ID documents; this script resolves those.
 *
 * What it does
 *   1. Government IDs are unlinked from applications (identity is account-level).
 *   2. Users with more than one pending ID keep only the newest pending one;
 *      older ones become "superseded" (history kept).
 *   3. Every user with an ID document or a non-"unverified" identity status gets
 *      User.identityDocument pointed at their authoritative ID document and the
 *      cached status re-derived from it (reconcile). In particular a user marked
 *      "verified" WITHOUT a reviewed ID document is moved to
 *      "resubmission_required" - nobody stays verified on a bare flag.
 *   4. A "legacy_migrated" history record is written once per migrated document.
 *   5. Retention dates are set on decided documents that have none.
 *   6. (--move-files) legacy public Cloudinary assets are moved to
 *      authenticated delivery and the public URL is removed from the record.
 *
 * Output contains counts and ids only: never names, emails, URLs or file content.
 */
/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../src/models/User");
const UserDocument = require("../src/models/UserDocument");
const IdentityVerificationRecord = require("../src/models/IdentityVerificationRecord");
const identity = require("../src/services/identityVerificationService");
const storage = require("../src/services/documentStorage");
const cfg = require("../src/config/identity");

const WRITE = { [User.IDENTITY_WRITE_OPTION]: true };
const DAY = 24 * 60 * 60 * 1000;

async function migrate({ apply = false, moveFiles = false, now = new Date() } = {}) {
  const stats = { unlinkedFromApplications: 0, pendingDeduplicated: 0, usersLinked: 0, usersReconciled: 0, verifiedWithoutDocument: 0, historyRecords: 0, retentionSet: 0, filesMoved: 0, filesFailed: 0 };

  // 1. Identity is account-level, never tied to one application.
  const linked = await UserDocument.countDocuments({ type: "government_id", application: { $ne: null } });
  stats.unlinkedFromApplications = linked;
  if (apply && linked) await UserDocument.updateMany({ type: "government_id", application: { $ne: null } }, { $set: { application: null } });

  // 2. At most one pending ID per user (required by the unique index).
  const dupes = await UserDocument.aggregate([
    { $match: { type: "government_id", status: "pending" } },
    { $group: { _id: "$user", ids: { $push: { id: "$_id", at: "$createdAt" } }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  for (const group of dupes) {
    const sorted = group.ids.sort((a, b) => b.at - a.at);
    const stale = sorted.slice(1).map((x) => x.id);
    stats.pendingDeduplicated += stale.length;
    if (apply) await UserDocument.updateMany({ _id: { $in: stale } }, { $set: { status: "superseded", supersededBy: sorted[0].id, supersededAt: now, imageDeleteAfter: new Date(now.getTime() + cfg.RETENTION_DAYS_OTHER * DAY) } });
  }

  // 3. Link + reconcile.
  const docUserIds = await UserDocument.distinct("user", { type: "government_id" });
  const users = await User.find({ $or: [{ _id: { $in: docUserIds } }, { identityVerificationStatus: { $ne: "unverified" } }] }).select("identityVerificationStatus identityDocument");
  for (const user of users) {
    const docs = await UserDocument.find({ user: user._id, type: "government_id", status: { $in: ["pending", "verified", "rejected", "resubmission_required", "expired"] } }).sort({ createdAt: -1 });
    const current = user.identityDocument ? docs.find((d) => String(d._id) === String(user.identityDocument)) : null;
    const authoritative =
      current ||
      docs.find((d) => d.status === "verified" && d.verifiedBy && !(d.expiresAt && d.expiresAt <= now)) ||
      docs.find((d) => d.status === "pending") ||
      docs[0] ||
      null;

    if (!authoritative && user.identityVerificationStatus === "verified") stats.verifiedWithoutDocument += 1;
    if (authoritative && String(user.identityDocument || "") !== String(authoritative._id)) {
      stats.usersLinked += 1;
      if (apply) await User.updateOne({ _id: user._id }, { $set: { identityDocument: authoritative._id } }, WRITE);
    }
    if (apply) {
      const result = await identity.reconcileUser(user._id, { now });
      if (result.changed) stats.usersReconciled += 1;
    } else {
      // Dry run: report what reconcile would change.
      const fresh = await User.findById(user._id);
      if (authoritative) fresh.identityDocument = authoritative._id;
      const evaluated = await identity.evaluateIdentity(fresh, { now });
      if (evaluated.status !== user.identityVerificationStatus) stats.usersReconciled += 1;
    }
    // 4. History marker, once per authoritative document.
    if (authoritative) {
      const exists = await IdentityVerificationRecord.exists({ document: authoritative._id, action: "legacy_migrated" });
      if (!exists) {
        stats.historyRecords += 1;
        if (apply) await IdentityVerificationRecord.create({ user: user._id, document: authoritative._id, action: "legacy_migrated", toStatus: authoritative.status, documentToStatus: authoritative.status, actor: null, actorRole: "system", idType: authoritative.idType, metadata: { note: "Pre-existing record adopted into the centralized identity model" } });
      }
    }
  }

  // 5. Retention dates for decided ID documents that have none.
  const needRetention = await UserDocument.find({ type: "government_id", imageDeleteAfter: null, fileRemovedAt: null, status: { $in: ["verified", "rejected", "resubmission_required", "expired", "superseded", "withdrawn"] } }).select("status verifiedAt updatedAt");
  for (const doc of needRetention) {
    stats.retentionSet += 1;
    if (apply) {
      const base = doc.verifiedAt || doc.updatedAt || now;
      const days = doc.status === "verified" ? cfg.RETENTION_DAYS_VERIFIED : cfg.RETENTION_DAYS_OTHER;
      await UserDocument.updateOne({ _id: doc._id }, { $set: { imageDeleteAfter: new Date(Math.max(now.getTime(), base.getTime() + days * DAY)) } });
    }
  }

  // 6. Legacy public files -> private delivery.
  if (moveFiles) {
    const cloudinary = require("../src/config/cloudinary");
    const legacy = await UserDocument.find({ fileUrl: { $type: "string", $ne: "" }, "storage.publicId": { $in: [null, undefined] } });
    for (const doc of legacy) {
      const publicId = storage.publicIdFromLegacyUrl(doc.fileUrl);
      const resourceType = /\/(raw|video)\/upload\//.test(doc.fileUrl) ? doc.fileUrl.match(/\/(raw|video)\/upload\//)[1] : "image";
      if (!publicId) {
        stats.filesFailed += 1;
        continue;
      }
      if (!apply) {
        stats.filesMoved += 1;
        continue;
      }
      try {
        await cloudinary.uploader.rename(publicId, publicId, { resource_type: resourceType, type: "upload", to_type: "authenticated", overwrite: true, invalidate: true });
        await UserDocument.updateOne({ _id: doc._id }, { $set: { storage: { provider: "cloudinary", publicId, resourceType, deliveryType: "authenticated" } }, $unset: { fileUrl: "" } });
        stats.filesMoved += 1;
      } catch (err) {
        stats.filesFailed += 1;
        console.error(`file move failed for document ${doc._id}: ${err.message}`);
      }
    }
  }

  if (apply) await UserDocument.createIndexes();
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const moveFiles = args.includes("--move-files");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const stats = await migrate({ apply, moveFiles });
    console.log(apply ? "APPLIED:" : "DRY RUN (nothing written; pass --apply):", JSON.stringify(stats, null, 2));
    if (!moveFiles) console.log("Legacy public ID files were NOT moved. Re-run with --move-files to move them to private delivery.");
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
}

module.exports = { migrate };
