/**
 * Identity-verification constants. Kept in one place so the backend service,
 * validators, jobs and docs cannot drift apart.
 *
 * Three independent kinds of verification exist in CarePaws and are never
 * interchangeable:
 *   1. Email verification        -> User.emailVerified
 *   2. Identity verification     -> User.identityVerificationStatus, derived
 *                                   from ONE authoritative government-ID
 *                                   UserDocument (User.identityDocument)
 *   3. Application documents     -> UserDocument rows of any other `type`
 *                                   (proof of address, income, ...)
 */

// What the user record (and the authoritative document) can be.
const IDENTITY_STATUSES = ["unverified", "pending", "verified", "rejected", "resubmission_required", "expired"];

// Document-level statuses: the user statuses above that describe a document,
// plus two terminal "history only" states.
const DOCUMENT_STATUSES = ["pending", "verified", "rejected", "resubmission_required", "expired", "superseded", "withdrawn"];

// Allowed user-level identity status transitions. Anything not listed is
// rejected by assertIdentityTransition().
const IDENTITY_TRANSITIONS = {
  unverified: ["pending"],
  pending: ["verified", "rejected", "resubmission_required", "unverified"], // unverified = applicant withdrew
  verified: ["expired", "rejected", "resubmission_required"], // rejected/resubmission = staff revocation
  rejected: ["pending"],
  resubmission_required: ["pending"],
  expired: ["pending"],
};

// Who may review government IDs. Least privilege: ID images are the most
// sensitive data in the system, so ordinary `staff` can assist walk-ins by
// uploading on their behalf but cannot see or decide on the images.
const IDENTITY_REVIEWER_ROLES = ["admin", "super_admin"];
// Who may upload an ID on behalf of a walk-in applicant.
const IDENTITY_ASSISTING_ROLES = ["staff", "admin", "super_admin"];

const ID_TYPES = ["passport", "drivers_license", "national_id", "state_id", "other_government_id"];
const ID_TYPE_LABELS = {
  passport: "Passport",
  drivers_license: "Driver's license",
  national_id: "National ID",
  state_id: "State / provincial ID",
  other_government_id: "Other government-issued photo ID",
};
// ID types that always carry an expiry date; the reviewer must confirm it.
const EXPIRY_REQUIRED_TYPES = ["passport", "drivers_license", "state_id"];

// Review checklist. `pass` is required for approval; items in NA_ALLOWED may
// also be "na" (not applicable) where the ID type genuinely has no such feature.
const CHECKLIST_ITEMS = [
  "imageReadable",
  "documentComplete",
  "acceptableIdType",
  "nameMatchesApplicant",
  "photoConsistent",
  "notExpired",
  "noVisibleAlterations",
];
const CHECKLIST_NA_ALLOWED = ["photoConsistent", "notExpired"];
const CHECKLIST_LABELS = {
  imageReadable: "Image is clear and readable",
  documentComplete: "Whole document is visible (no cropped edges)",
  acceptableIdType: "Acceptable government-issued ID type",
  nameMatchesApplicant: "Name matches the applicant's account",
  photoConsistent: "Photo is consistent with the applicant, where appropriate",
  notExpired: "Document is not expired",
  noVisibleAlterations: "No visible alterations or inconsistencies",
};

// Stored with every decision so nobody mistakes it for forensic verification.
const ASSESSMENT_TYPE = "staff_visual_review";
const REVIEW_DISCLAIMER =
  "Staff visual assessment of the submitted image only. It is not forensic authentication and does not confirm the ID against any government database.";

const MIN_REASON_LENGTH = 5;
// A verified ID may be renewed (replacement uploaded) this long before it expires.
const RENEWAL_WINDOW_DAYS = 30;

// Retention of the ID *image* (the verification record itself is kept).
// Verified: image kept briefly for dispute handling, then purged.
// Anything else (rejected, replaced, expired, withdrawn): shorter.
const RETENTION_DAYS_VERIFIED = Number(process.env.IDENTITY_IMAGE_RETENTION_DAYS_VERIFIED) || 30;
const RETENTION_DAYS_OTHER = Number(process.env.IDENTITY_IMAGE_RETENTION_DAYS_OTHER) || 14;

// Shelter policy for when identity must be verified, per application type.
const IDENTITY_POLICY_VALUES = ["before_submission", "before_review", "none"];
const DEFAULT_IDENTITY_POLICY = { adoption: "before_submission", foster: "before_submission" };

module.exports = {
  IDENTITY_STATUSES,
  DOCUMENT_STATUSES,
  IDENTITY_TRANSITIONS,
  IDENTITY_REVIEWER_ROLES,
  IDENTITY_ASSISTING_ROLES,
  ID_TYPES,
  ID_TYPE_LABELS,
  EXPIRY_REQUIRED_TYPES,
  CHECKLIST_ITEMS,
  CHECKLIST_NA_ALLOWED,
  CHECKLIST_LABELS,
  ASSESSMENT_TYPE,
  REVIEW_DISCLAIMER,
  MIN_REASON_LENGTH,
  RENEWAL_WINDOW_DAYS,
  RETENTION_DAYS_VERIFIED,
  RETENTION_DAYS_OTHER,
  IDENTITY_POLICY_VALUES,
  DEFAULT_IDENTITY_POLICY,
};
