import axios from "axios";
import { Alert } from "react-native";
import { router } from "expo-router";
import { api } from "./api";

/**
 * Identity verification (government ID) on the mobile app.
 *
 * Three different things are verified in CarePaws and the app never mixes them:
 *   - email          -> "Email not verified" banner on Profile
 *   - identity       -> this file / the Identity card on the Documents screen
 *   - application documents (proof of address, ...) -> "Application documents" list
 * The server is the only authority: this file never decides that someone is
 * verified, it only displays what GET /api/identity/me returns.
 */

export type IdentityStatus = "unverified" | "pending" | "verified" | "rejected" | "resubmission_required" | "expired";

export interface IdTypeOption {
  value: string;
  label: string;
  expiryRequired: boolean;
}

export interface IdentityOverview {
  status: IdentityStatus;
  emailVerified: boolean;
  reason: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  expiringSoon: boolean;
  document: { _id: string; status: string; idType: string | null; createdAt: string; hasFile: boolean } | null;
  pendingDocument: { _id: string; status: string; idType: string | null; createdAt: string } | null;
  canUpload: boolean;
  canWithdraw: boolean;
  isRenewal: boolean;
  idTypes: IdTypeOption[];
  policy: { adoption: "before_submission" | "before_review" | "none"; foster: "before_submission" | "before_review" | "none" };
  history: { _id: string; action: string; status: string | null; reason: string | null; createdAt: string }[];
}

export async function fetchIdentity(): Promise<IdentityOverview> {
  const res = await api.get("/api/identity/me");
  return res.data.data as IdentityOverview;
}

export type Tone = "success" | "warning" | "danger" | "neutral";

export interface IdentityCopy {
  title: string;
  body: string;
  tone: Tone;
  actionLabel: string | null;
}

export const WHY_IDENTITY_IS_REQUIRED =
  "To protect the animals in our care, the shelter checks that every adopter and foster parent has a valid government-issued photo ID. Staff review your ID once. It is then used for both adoption and foster applications. This is separate from verifying your email.";

/** What to tell the person for each identity state (reason / expiry included). */
export function describeIdentity(o: Pick<IdentityOverview, "status" | "reason" | "expiresAt" | "daysUntilExpiry" | "expiringSoon" | "canUpload">): IdentityCopy {
  const expires = o.expiresAt ? new Date(o.expiresAt).toLocaleDateString() : null;
  switch (o.status) {
    case "verified":
      if (o.expiringSoon && o.daysUntilExpiry !== null) {
        return {
          title: "Identity verified",
          body: `Your ID expires in ${Math.max(o.daysUntilExpiry, 0)} day${o.daysUntilExpiry === 1 ? "" : "s"}${expires ? ` (${expires})` : ""}. Upload a renewed ID now so you can keep applying. You stay verified until the new one is approved.`,
          tone: "warning",
          actionLabel: o.canUpload ? "Upload renewed ID" : null,
        };
      }
      return { title: "Identity verified", body: expires ? `Staff reviewed and accepted your ID. It is valid until ${expires}.` : "Staff reviewed and accepted your ID.", tone: "success", actionLabel: null };
    case "pending":
      return { title: "Waiting for staff review", body: "We received your ID. Staff will review it and you will be notified of the decision. You do not need to upload it again.", tone: "warning", actionLabel: null };
    case "rejected":
      return { title: "ID was not accepted", body: `${o.reason ? `Reason: ${o.reason}. ` : ""}Please upload a new, clear photo of a valid government-issued ID.`, tone: "danger", actionLabel: o.canUpload ? "Upload a new ID" : null };
    case "resubmission_required":
      return { title: "Please upload your ID again", body: `${o.reason ? `Reason: ${o.reason}. ` : ""}Staff need a replacement image before they can verify you.`, tone: "warning", actionLabel: o.canUpload ? "Upload a new ID" : null };
    case "expired":
      return { title: "Your ID has expired", body: `${expires ? `It expired on ${expires}. ` : ""}Upload a current government-issued ID to apply again.`, tone: "danger", actionLabel: o.canUpload ? "Upload a current ID" : null };
    default:
      return { title: "Identity not verified", body: "Upload a government-issued photo ID so staff can verify you before you apply.", tone: "neutral", actionLabel: o.canUpload ? "Upload government ID" : null };
  }
}

/** Parses the expiry text field. Empty is allowed here; whether it is required depends on the ID type. */
export function parseExpiryInput(text: string, now: Date = new Date()): { ok: true; value: string | null } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return { ok: false, message: "Enter the expiry date as YYYY-MM-DD, for example 2029-08-31." };
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return { ok: false, message: "That date does not exist." };
  const endOfDay = Date.UTC(y, m - 1, d, 23, 59, 59);
  if (endOfDay <= now.getTime()) return { ok: false, message: "This ID has already expired. Please use a current ID." };
  return { ok: true, value: trimmed };
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
}

export type UploadFailureKind = "network" | "duplicate_pending" | "already_verified" | "duplicate_file" | "validation" | "unauthorized" | "server";
export interface UploadFailure {
  kind: UploadFailureKind;
  message: string;
  code?: string;
}

/** Turns any upload error into something the screen can act on (and explain). */
export function classifyUploadError(err: unknown): UploadFailure {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return {
        kind: "network",
        message: "Your connection was interrupted during the upload. Check your internet and try again. If you are unsure whether it went through, your ID status below will update once we receive it.",
      };
    }
    const data = err.response.data as { code?: string; message?: string } | undefined;
    const code = data?.code;
    const message = data?.message || "The upload failed. Please try again.";
    if (err.response.status === 401 || err.response.status === 403) return { kind: "unauthorized", message, code };
    if (code === "DUPLICATE_PENDING") return { kind: "duplicate_pending", message, code };
    if (code === "ALREADY_VERIFIED") return { kind: "already_verified", message, code };
    if (code === "DUPLICATE_FILE") return { kind: "duplicate_file", message, code };
    if (err.response.status >= 400 && err.response.status < 500) return { kind: "validation", message, code };
    return { kind: "server", message: "Something went wrong on our side. Please try again in a moment.", code };
  }
  return { kind: "server", message: "The upload failed. Please try again." };
}

/** POST /api/identity/documents with real upload progress (0-100). Throws the raw error; use classifyUploadError. */
export async function uploadIdentityDocument(args: { file: PickedFile; idType: string; expiresAt: string | null; onProgress?: (percent: number) => void }) {
  const form = new FormData();
  form.append("idType", args.idType);
  if (args.expiresAt) form.append("expiresAt", args.expiresAt);
  form.append("file", { uri: args.file.uri, name: args.file.name, type: args.file.mimeType ?? "application/octet-stream" } as unknown as Blob);
  // Content-Type is left to axios/React Native so the multipart boundary is computed correctly.
  const res = await api.post("/api/identity/documents", form, {
    timeout: 120000, // photos on slow mobile networks need longer than the default 20s
    onUploadProgress: (e) => {
      if (args.onProgress && e.total) args.onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    },
  });
  return res.data;
}

export async function withdrawIdentityDocument(documentId: string) {
  const res = await api.delete(`/api/identity/documents/${documentId}`);
  return res.data;
}

/**
 * Friendly pre-check before opening an application form. This is only a
 * convenience: the server enforces the rule on submit regardless. If the
 * check itself cannot be made (offline), the person is let through and the
 * server decides.
 */
export async function ensureIdentityBeforeApplying(type: "adoption" | "foster"): Promise<boolean> {
  let overview: IdentityOverview;
  try {
    overview = await fetchIdentity();
  } catch {
    return true;
  }
  // Unexpected response shape: do not block on a pre-check; the server decides on submit.
  if (!overview || !overview.policy) return true;
  if (overview.policy[type] !== "before_submission" || overview.status === "verified") return true;
  const copy = describeIdentity(overview);
  Alert.alert(`Verify your identity first`, `${copy.title}. ${copy.body}`, [
    { text: "Not now", style: "cancel" },
    { text: overview.canUpload ? "Verify my ID" : "View status", onPress: () => router.push("/documents") },
  ]);
  return false;
}
