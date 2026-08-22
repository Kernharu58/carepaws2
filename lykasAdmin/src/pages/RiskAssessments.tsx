import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { useApplications } from "../hooks/useApplications";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { FormField, Input, Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";

interface RiskAssessment {
  _id: string;
  application?: { _id: string };
  applicant: { displayName: string };
  pet: { name: string };
  totalScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendation: string;
  createdAt: string;
}

const DIMENSIONS = [
  ["housingStability", "Housing stability"],
  ["financialReadiness", "Financial readiness"],
  ["petExperience", "Pet experience"],
  ["lifestyleMatch", "Lifestyle match"],
  ["familyCommitment", "Family commitment"],
  ["knowledgeOfPet", "Knowledge of pet"],
] as const;

export default function RiskAssessments() {
  const list = useResourceList<RiskAssessment>("/api/risk-assessments");
  const applications = useApplications();
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(DIMENSIONS.map(([key]) => [key, "3"]))
  );
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("Further Review");
  const [redFlags, setRedFlags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<RiskAssessment>[] = [
    { key: "applicant", header: "Applicant", accessor: (r) => r.applicant?.displayName },
    { key: "pet", header: "Pet", accessor: (r) => r.pet?.name },
    { key: "totalScore", header: "Score", accessor: (r) => `${r.totalScore}/30` },
    {
      key: "riskLevel",
      header: "Risk level",
      accessor: (r) => <StatusBadge status={r.riskLevel} tone={r.riskLevel === "Low" ? "success" : r.riskLevel === "Medium" ? "warning" : "danger"} />,
    },
    { key: "recommendation", header: "Recommendation", accessor: (r) => r.recommendation },
  ];

  async function createAssessment(e: FormEvent) {
    e.preventDefault();
    if (!applicationId) {
      setError("Select an application.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/risk-assessments", {
        application: applicationId,
        scores: Object.fromEntries(DIMENSIONS.map(([key]) => [key, Number(scores[key])])),
        notes: notes || undefined,
        recommendation,
        redFlags: redFlags.split(",").map((v) => v.trim()).filter(Boolean),
      });
      showToast("Risk assessment saved", "success");
      setCreating(false);
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save risk assessment"));
    } finally {
      setSaving(false);
    }
  }

  const selectableApplications = applications.rows.filter(
    (a) => a.status !== "rejected" && !["completed", "rejected"].includes(a.stage)
  );

  return (
    <div>
      <PageHeader
        title="Risk Assessments"
        description="Scores and risk levels are computed server-side from the six weighted dimensions."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New assessment</Button>}
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(r) => r._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No risk assessments yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
      />

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title="New risk assessment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="create-risk-form" loading={saving}>Save assessment</Button>
          </>
        }
      >
        <form id="create-risk-form" onSubmit={createAssessment}>
          {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
          <FormField label="Application" htmlFor="risk-application">
            <Select id="risk-application" required value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">Select an application</option>
              {selectableApplications.map((a) => <option key={a._id} value={a._id}>{a.applicant?.displayName} — {a.pet?.name}</option>)}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            {DIMENSIONS.map(([key, label]) => (
              <FormField key={key} label={label} htmlFor={`risk-${key}`}>
                <Input
                  id={`risk-${key}`}
                  type="number"
                  min={1}
                  max={5}
                  required
                  value={scores[key]}
                  onChange={(e) => setScores((current) => ({ ...current, [key]: e.target.value }))}
                />
              </FormField>
            ))}
          </div>

          <FormField label="Recommendation" htmlFor="risk-recommendation">
            <Select id="risk-recommendation" value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>
              <option>Approve</option><option>Reject</option><option>Further Review</option>
            </Select>
          </FormField>
          <FormField label="Red flags (comma-separated)" htmlFor="risk-red-flags">
            <Input id="risk-red-flags" value={redFlags} onChange={(e) => setRedFlags(e.target.value)} />
          </FormField>
          <FormField label="Notes" htmlFor="risk-notes">
            <Input id="risk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
