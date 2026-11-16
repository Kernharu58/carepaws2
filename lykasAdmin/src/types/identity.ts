export type IdentityDocStatus = "pending" | "verified" | "rejected" | "resubmission_required" | "expired" | "superseded" | "withdrawn";
export type ChecklistValue = "pass" | "fail" | "na";
export type IdentityDecision = "approve" | "reject" | "request_resubmission";

export interface IdentityApplicant {
  _id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  emailVerified?: boolean;
  identityVerificationStatus?: string;
}

export interface IdentityQueueRow {
  _id: string;
  user: IdentityApplicant;
  idType: string | null;
  status: IdentityDocStatus;
  expiresAt: string | null;
  isExpired: boolean;
  isRenewal: boolean;
  submissionChannel: "self" | "staff_assisted" | null;
  hasFile: boolean;
  createdAt: string;
  rejectedReason?: string | null;
  verifiedBy?: { displayName: string } | null;
  verifiedAt?: string | null;
}

export interface IdentityHistoryEntry {
  _id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actor: { displayName: string; role: string } | null;
  actorRole: string | null;
  createdAt: string;
  idType?: string | null;
}

export interface ChecklistItemDef {
  key: string;
  label: string;
  naAllowed: boolean;
}

export interface IdentityDetail {
  document: IdentityQueueRow & {
    fileType?: string;
    submittedBy?: { displayName: string; role: string } | null;
    viewedByYou: boolean;
    canReview: boolean;
    notes?: string;
  };
  history: IdentityHistoryEntry[];
  warnings: string[];
  checklist: ChecklistItemDef[];
  disclaimer: string;
  minReasonLength: number;
}

export interface ReviewPayload {
  decision: IdentityDecision;
  checklist?: Record<string, ChecklistValue>;
  reason?: string;
  expiresAt?: string;
  assessmentNote?: string;
}

export const ID_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's license",
  national_id: "National ID",
  state_id: "State / provincial ID",
  other_government_id: "Other government photo ID",
};
export const EXPIRY_REQUIRED_TYPES = ["passport", "drivers_license", "state_id"];

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  submitted: "ID submitted",
  staff_assisted_submission: "ID submitted by staff (walk-in)",
  approved: "Identity approved",
  rejected: "ID rejected",
  resubmission_requested: "Resubmission requested",
  revoked: "Verification revoked",
  expired: "ID expired",
  superseded: "Replaced by a newer ID",
  withdrawn: "Applicant withdrew ID",
  image_purged: "ID image deleted (retention)",
  status_reconciled: "Status repaired from document record",
  legacy_migrated: "Migrated from legacy record",
};
