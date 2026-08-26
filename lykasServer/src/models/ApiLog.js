const mongoose = require("mongoose");

// 30 days, in seconds, for the TTL index below.
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

const apiLogSchema = new mongoose.Schema({
  method: { type: String, required: true },
  path: { type: String, required: true },
  statusCode: { type: Number },
  durationMs: { type: Number },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// TTL index — ApiLog gets a row on essentially every /api/* request (see
// apiMonitorMiddleware.js), so unlike the app's business collections
// (which only grow with real shelter activity: pets, applications,
// payments), it has no natural cap and was growing without bound.
//
// Nothing in the codebase queries it further back than 24h (see
// GET /api/monitoring/api/summary's `windowHours: 24`), so 30 days is
// pure safety margin for someone manually digging into "what happened
// last week", not a functional requirement. It also keeps the collection
// bounded on the low-cost MongoDB Atlas tier this app is deployed on
// (manuscript, Ch. I "Organizational Assessment"; README deployment
// notes), and sits more comfortably with the data-minimization /
// storage-limitation expectations the manuscript ties its security NFRs
// to under the Philippine Data Privacy Act, RA 10173, than unbounded
// retention would.
//
// Mirrors the TTL pattern already used in TokenBlacklist.js. Note that
// MongoDB's TTL monitor sweeps expired documents roughly once every 60
// seconds, not instantly on expiry — tests should assert on the index
// definition, not on a document actually disappearing in real time.
apiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

module.exports = mongoose.model("ApiLog", apiLogSchema);
module.exports.RETENTION_SECONDS = RETENTION_SECONDS;
