import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader, Card } from "../components/ui/SharedUI";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/StateDisplays";
import StatusBadge from "../components/ui/StatusBadge";
import Button from "../components/ui/Button";
import TextArea from "../components/ui/TextArea";
import { useToast } from "../context/ToastContext";
import type { ApplicationStage } from "../hooks/useApplications";

interface ApplicationDetail {
  _id: string;
  pet: { _id: string; name: string; species?: string; status?: string };
  applicant: { _id: string; displayName: string; email: string };
  phone?: string;
  address?: string;
  experience?: string;
  householdSize?: number;
  isRenting?: boolean;
  landlordApproval?: boolean;
  type: "adoption" | "foster";
  status: "pending" | "approved" | "rejected";
  stage: ApplicationStage;
  createdAt: string;
  reviewedAt?: string | null;
  stageHistory: { stage: string; changedAt: string; note?: string; changedBy?: { displayName: string } }[];
  internalNotes?: { author?: { displayName: string }; text: string; createdAt: string }[];
}

const STAGES: ApplicationStage[] = [
  "submitted",
  "document_review",
  "interview",
  "home_visit",
  "risk_assessment",
  "approved",
  "adoption_scheduled",
  "completed",
  "rejected",
];

const LABELS: Record<string, string> = {
  submitted: "Submitted",
  document_review: "Document review",
  interview: "Interview",
  home_visit: "Home visit",
  risk_assessment: "Risk assessment",
  approved: "Approved",
  adoption_scheduled: "Adoption scheduled",
  completed: "Completed",
  rejected: "Rejected",
};

export default function ApplicationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/applications/${id}`);
      setApplication(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load application"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStage(stage: ApplicationStage) {
    if (!application || saving || stage === application.stage) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/applications/${application._id}/stage`, { stage });
      setApplication(res.data.data);
      showToast(`Stage changed to ${LABELS[stage]}`, "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update application stage"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: "approved" | "rejected") {
    if (!application || saving) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/applications/${application._id}/status`, { status });
      setApplication(res.data.data);
      showToast(`Application ${status}`, "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update application status"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!application || !notes.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      const res = await api.post(`/api/applications/${application._id}/notes`, { text: notes.trim() });
      setApplication((current) => current ? { ...current, internalNotes: res.data.data } : current);
      setNotes("");
      showToast("Internal note added", "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to add note"), "error");
    } finally {
      setNoteSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading application…" />;
  if (error || !application) return <ErrorState message={error ?? "Application not found"} onRetry={load} />;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/adoptions")}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to applications
      </button>

      <PageHeader
        title={`${application.pet?.name ?? "Pet"} — application`}
        description={`Submitted by ${application.applicant?.displayName ?? "Unknown applicant"}.`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">{application.applicant.displayName}</h2>
                <p className="text-sm text-gray-500">{application.applicant.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={application.status} />
                <StatusBadge status={application.type} tone="neutral" />
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-gray-400">Phone</dt><dd className="text-gray-700">{application.phone || "—"}</dd></div>
              <div><dt className="text-gray-400">Household size</dt><dd className="text-gray-700">{application.householdSize ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-400">Address</dt><dd className="text-gray-700">{application.address || "—"}</dd></div>
              <div><dt className="text-gray-400">Renting</dt><dd className="text-gray-700">{application.isRenting ? "Yes" : "No"}</dd></div>
              <div><dt className="text-gray-400">Landlord approval</dt><dd className="text-gray-700">{application.isRenting ? (application.landlordApproval ? "Yes" : "No") : "N/A"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-400">Experience</dt><dd className="whitespace-pre-wrap text-gray-700">{application.experience || "—"}</dd></div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Pipeline</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STAGES.map((stage) => (
                <Button
                  key={stage}
                  type="button"
                  variant={application.stage === stage ? "primary" : "secondary"}
                  disabled={saving}
                  onClick={() => changeStage(stage)}
                  className="justify-start"
                >
                  {application.stage === stage && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {LABELS[stage]}
                </Button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Stage history</h2>
            {application.stageHistory?.length ? (
              <div className="space-y-2">
                {application.stageHistory.slice().reverse().map((entry, index) => (
                  <div key={`${entry.changedAt}-${index}`} className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">{LABELS[entry.stage] ?? entry.stage}</span>
                      <span className="text-xs text-gray-400">{new Date(entry.changedAt).toLocaleString()}</span>
                    </div>
                    {entry.note && <p className="mt-1 text-xs text-gray-500">{entry.note}</p>}
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No stage history" />}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Decision</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                disabled={saving || application.status === "approved"}
                onClick={() => changeStatus("approved")}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={saving || application.status === "rejected"}
                onClick={() => changeStatus("rejected")}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Approval updates the application to approved and the pet to Adopted; rejection returns the pet to Available.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Internal notes</h2>
            <div className="mb-3 space-y-2">
              {application.internalNotes?.length ? application.internalNotes.map((note, index) => (
                <div key={`${note.createdAt}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-sm text-gray-700">{note.text}</p>
                  <p className="mt-1 text-xs text-gray-400">{note.author?.displayName ?? "Staff"} · {new Date(note.createdAt).toLocaleString()}</p>
                </div>
              )) : <p className="text-sm text-gray-400">No internal notes.</p>}
            </div>
            <TextArea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add an internal note…" />
            <div className="mt-2 flex justify-end">
              <Button type="button" onClick={addNote} loading={noteSaving} disabled={!notes.trim()}>
                Add note
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
