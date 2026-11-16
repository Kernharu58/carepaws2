const crypto = require("crypto");
const { Readable } = require("stream");
const cloudinary = require("../config/cloudinary");

/**
 * Private file storage for user documents (government IDs especially).
 *
 * New uploads go to Cloudinary with delivery type "authenticated": the asset
 * has NO public URL. The only way to read it is a short-lived *signed* URL
 * that this server generates and fetches itself - it is never sent to a
 * client. Clients read files through the authorised proxy endpoint instead
 * (GET /api/identity/documents/:id/file).
 *
 * Legacy records (created before this change) only have a public `fileUrl`.
 * They can still be proxied, and scripts/migrate-identity-verification.js
 * moves those assets to authenticated delivery.
 *
 * Nothing in this module logs URLs, file contents or public ids.
 */

const FOLDER = "carepaws/private-documents";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function storePrivate(buffer, { folder = FOLDER } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto", type: "authenticated", overwrite: false },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          provider: "cloudinary",
          publicId: result.public_id,
          resourceType: result.resource_type || "image",
          deliveryType: "authenticated",
        });
      }
    );
    stream.end(buffer);
  });
}

function signedUrlFor(storage) {
  return cloudinary.url(storage.publicId, {
    resource_type: storage.resourceType || "image",
    type: storage.deliveryType || "authenticated",
    sign_url: true,
    secure: true,
    // The URL carries Cloudinary's signature, which prevents guessing it. It is
    // NOT time-limited (that needs Cloudinary token-based auth, which is not
    // configured here); it is safe only because it is generated and fetched
    // server-side within this request and never returned to or logged for a client.
  });
}

/**
 * Returns a Node readable stream for the stored file, or throws an error with
 * statusCode 404/502. `doc` is a UserDocument (needs storage or legacy fileUrl).
 */
async function openStream(doc) {
  // A purged / withdrawn image is gone: decide that before touching storage.
  if (doc.fileRemovedAt) {
    throw Object.assign(new Error("The file for this document is no longer available"), { statusCode: 404 });
  }
  let url = null;
  if (doc.storage && doc.storage.publicId) url = signedUrlFor(doc.storage);
  else if (doc.fileUrl) url = doc.fileUrl; // legacy public asset, proxied
  if (!url) {
    throw Object.assign(new Error("The file for this document is no longer available"), { statusCode: 404 });
  }
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw Object.assign(new Error("The file could not be retrieved"), { statusCode: 502 });
  }
  if (!response.ok || !response.body) {
    throw Object.assign(new Error("The file could not be retrieved"), { statusCode: response.status === 404 ? 404 : 502 });
  }
  return { stream: Readable.fromWeb(response.body), contentType: response.headers.get("content-type") };
}

async function destroy(doc) {
  const storage = doc.storage && doc.storage.publicId ? doc.storage : null;
  const publicId = storage ? storage.publicId : publicIdFromLegacyUrl(doc.fileUrl);
  if (!publicId) return false;
  await cloudinary.uploader.destroy(publicId, {
    resource_type: (storage && storage.resourceType) || "image",
    type: (storage && storage.deliveryType) || "upload",
    invalidate: true,
  });
  return true;
}

// https://res.cloudinary.com/<cloud>/<resource>/upload/v123/<folder>/<id>.<ext>
function publicIdFromLegacyUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return match ? match[1] : null;
}

module.exports = { storePrivate, openStream, destroy, sha256, publicIdFromLegacyUrl };
