import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import TextArea from "../ui/TextArea";
import StatusBadge from "../ui/StatusBadge";
import { getApiErrorMessage } from "../../services/api";
import { fetchIdentityDetail, fetchIdentityFile, submitIdentityReview } from "../../services/identity";
import { EXPIRY_REQUIRED_TYPES, HISTORY_ACTION_LABELS, ID_TYPE_LABELS, type ChecklistValue, type IdentityDecision, type IdentityDetail } from "../../types/identity";

interface Props {
  documentId: string | null;
  onClose: () => void;
  onDecided: (message: string) => void;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

export default function IdentityReviewModal({ documentId, onClose, onDecided }: Props) {
  const [detail, setDetail] = useState<IdentityDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [viewed, setViewed] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, ChecklistValue | "">>({});
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState<IdentityDecision | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setDetail(null);
    setLoadError(null);
    setImageUrl(null);
    setImageError(null);
    setViewed(false);
    setChecklist({});
    setReason("");
    setSubmitError(null);
    setReasonError(null);
    try {
      const d = await fetchIdentityDetail(id);
      setDetail(d);
      setViewed(d.document.viewedByYou);
      setExpiresAt(d.document.expiresAt ? d.document.expiresAt.slice(0, 10) : "");
    } catch (err) {
      setLoadError(getApiErrorMessage(err, "Could not load this identity document"));
      return;
    }
    // Opening the image is what records that this reviewer looked at it.
    try {
      const blob = await fetchIdentityFile(id);
      setImageType(blob.type);
      setImageUrl(URL.createObjectURL(blob));
      setViewed(true);
    } catch (err) {
      setImageError(getApiErrorMessage(err, "The ID image could not be loaded"));
    }
  }, []);

  useEffect(() => {
    if (documentId) void load(documentId);
  }, [documentId, load]);

  // Object URLs hold the image in memory: release when replaced or closed.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const doc = detail?.document;
  const decidable = doc && (doc.status === "pending" || doc.status === "verified");
  const isRevocation = doc?.status === "verified";
  const expiryRequired = doc?.idType ? EXPIRY_REQUIRED_TYPES.includes(doc.idType) : false;

  const checklistComplete = useMemo(() => {
    if (!detail) return false;
    return detail.checklist.every((item) => {
      const v = checklist[item.key];
      return v === "pass" || (v === "na" && item.naAllowed);
    });
  }, [detail, checklist]);

  const canApprove = Boolean(doc && doc.status === "pending" && doc.canReview && viewed && checklistComplete && (!expiryRequired || expiresAt));
  const minReason = detail?.minReasonLength ?? 5;

  async function decide(decision: IdentityDecision) {
    if (!doc || submitting) return;
    setSubmitError(null);
    if (decision !== "approve" && reason.trim().length < minReason) {
      setReasonError(`Enter a reason of at least ${minReason} characters. The applicant will see it.`);
      return;
    }
    setReasonError(null);
    setSubmitting(decision);
    try {
      const filled = Object.fromEntries(Object.entries(checklist).filter(([, v]) => v)) as Record<string, ChecklistValue>;
      await submitIdentityReview(doc._id, {
        decision,
        checklist: Object.keys(filled).length ? filled : undefined,
        reason: reason.trim() || undefined,
        expiresAt: decision === "approve" && expiresAt ? expiresAt : undefined,
      });
      onDecided(decision === "approve" ? "Identity approved" : decision === "reject" ? (isRevocation ? "Verification revoked" : "ID rejected") : "Resubmission requested");
    } catch (err) {
      // Keep the typed reason / checklist so nothing is lost; show the server's explanation.
      setSubmitError(getApiErrorMessage(err, "The decision could not be saved"));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Modal
      isOpen={documentId !== null}
      onClose={onClose}
      title="Identity verification review"
      footer={
        doc && decidable ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting !== null}>
              Close
            </Button>
            <Button variant="secondary" loading={submitting === "request_resubmission"} disabled={submitting !== null || !doc.canReview} onClick={() => decide("request_resubmission")}>
              {isRevocation ? "Revoke: require new ID" : "Request resubmission"}
            </Button>
            <Button variant="danger" loading={submitting === "reject"} disabled={submitting !== null || !doc.canReview} onClick={() => decide("reject")}>
              {isRevocation ? "Revoke: reject ID" : "Reject identity"}
            </Button>
            {!isRevocation && (
              <Button loading={submitting === "approve"} disabled={submitting !== null || !canApprove} onClick={() => decide("approve")}>
                Approve identity
              </Button>
            )}
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {loadError && (
        <p role="alert" className="text-sm text-status-danger">
          {loadError}
        </p>
      )}
      {!detail && !loadError && <p className="text-sm text-gray-500">Loading…</p>}

      {detail && doc && (
        <div className="space-y-5 text-sm">
          {detail.warnings.map((w) => (
            <p key={w} role="alert" className="flex items-start gap-2 rounded-lg bg-status-warningBg p-2 text-status-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {w}
            </p>
          ))}
          {!doc.canReview && (
            <p role="alert" className="rounded-lg bg-status-warningBg p-2 text-status-warning">
              You cannot decide on this document (it is your own, or you uploaded it on the applicant's behalf). Another admin must review it.
            </p>
          )}

          <section aria-label="Applicant information">
            <h3 className="mb-1 font-semibold text-gray-900">Applicant</h3>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1">
              <dt className="text-gray-500">Name</dt>
              <dd>{doc.user.displayName}</dd>
              <dt className="text-gray-500">Email</dt>
              <dd>
                {doc.user.email} <span className="text-xs text-gray-500">({doc.user.emailVerified ? "email verified" : "email not verified"})</span>
              </dd>
              <dt className="text-gray-500">Phone</dt>
              <dd>{doc.user.phone || "—"}</dd>
              <dt className="text-gray-500">Address</dt>
              <dd>{doc.user.address || "—"}</dd>
            </dl>
          </section>

          <section aria-label="Government ID">
            <h3 className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
              Government ID <StatusBadge status={doc.status} />
              {doc.isExpired && <StatusBadge status="expired" />}
              {doc.isRenewal && <span className="rounded-full bg-status-neutralBg px-2 py-0.5 text-xs text-status-neutral">Renewal</span>}
            </h3>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1">
              <dt className="text-gray-500">ID type</dt>
              <dd>{doc.idType ? ID_TYPE_LABELS[doc.idType] ?? doc.idType : "Not recorded (legacy upload)"}</dd>
              <dt className="text-gray-500">Expiry</dt>
              <dd className={doc.isExpired ? "font-medium text-status-danger" : ""}>
                {doc.expiresAt ? fmtDate(doc.expiresAt) : "None entered"}
                {doc.isExpired ? " — EXPIRED" : ""}
              </dd>
              <dt className="text-gray-500">Submitted</dt>
              <dd>
                {fmt(doc.createdAt)}
                {doc.submissionChannel === "staff_assisted" && doc.submittedBy ? ` — uploaded by staff (${doc.submittedBy.displayName})` : ""}
              </dd>
            </dl>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
              {imageError && (
                <p role="alert" className="text-status-danger">
                  {imageError}
                </p>
              )}
              {!imageUrl && !imageError && <p className="text-gray-500">Loading ID image…</p>}
              {imageUrl && imageType === "application/pdf" && <iframe title="Government ID preview" src={imageUrl} className="h-96 w-full rounded" />}
              {imageUrl && imageType !== "application/pdf" && <img src={imageUrl} alt="Government ID preview" className="mx-auto max-h-96 rounded" />}
            </div>
          </section>

          {decidable && doc.canReview && (
            <section aria-label="Verification checklist">
              <h3 className="mb-1 font-semibold text-gray-900">Verification checklist</h3>
              {!isRevocation && <p className="mb-2 text-xs text-gray-500">Every item must pass to approve. Use reject or request resubmission if anything fails.</p>}
              <ul className="space-y-1.5">
                {detail.checklist.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3">
                    <label htmlFor={`chk-${item.key}`}>{item.label}</label>
                    <select
                      id={`chk-${item.key}`}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      value={checklist[item.key] ?? ""}
                      onChange={(e) => setChecklist((c) => ({ ...c, [item.key]: e.target.value as ChecklistValue | "" }))}
                    >
                      <option value="">Select…</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                      {item.naAllowed && <option value="na">N/A</option>}
                    </select>
                  </li>
                ))}
              </ul>
              {!isRevocation && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <label htmlFor="confirmed-expiry">Expiry date on the ID{expiryRequired ? " (required)" : ""}</label>
                  <input id="confirmed-expiry" type="date" className="rounded-lg border border-gray-300 px-2 py-1 text-sm" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              )}
              {!viewed && !isRevocation && <p className="mt-2 text-xs text-status-warning">The ID image must load before you can approve.</p>}
            </section>
          )}

          {decidable && doc.canReview && (
            <section aria-label="Decision reason">
              <label htmlFor="identity-reason" className="mb-1 block font-semibold text-gray-900">
                Reason (required to reject or request resubmission)
              </label>
              <TextArea id="identity-reason" rows={3} placeholder="e.g. The photo is blurry — please retake it in good light" value={reason} onChange={(e) => setReason(e.target.value)} />
              {reasonError && (
                <p role="alert" className="mt-1 text-xs text-status-danger">
                  {reasonError}
                </p>
              )}
            </section>
          )}

          {submitError && (
            <p role="alert" className="rounded-lg bg-status-dangerBg p-2 text-status-danger">
              {submitError}
            </p>
          )}

          <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {detail.disclaimer}
          </p>

          <section aria-label="Verification history">
            <h3 className="mb-1 font-semibold text-gray-900">Verification history</h3>
            {detail.history.length === 0 ? (
              <p className="text-gray-500">No history yet.</p>
            ) : (
              <ol className="space-y-2">
                {detail.history.map((h) => (
                  <li key={h._id} className="border-l-2 border-gray-200 pl-3">
                    <p className="font-medium">{HISTORY_ACTION_LABELS[h.action] ?? h.action}</p>
                    <p className="text-xs text-gray-500">
                      {fmt(h.createdAt)} · {h.actor ? `${h.actor.displayName} (${h.actor.role})` : h.actorRole === "system" ? "System" : "Applicant"}
                      {h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus ? ` · ${h.fromStatus.replace(/_/g, " ")} → ${h.toStatus.replace(/_/g, " ")}` : ""}
                    </p>
                    {h.reason && <p className="text-xs text-gray-700">Reason: {h.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
