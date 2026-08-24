import { useState, type FormEvent } from "react";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { useApplications } from "../hooks/useApplications";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import TextArea from "../components/ui/TextArea";
import { FormField, Input, Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";

interface Interview {
  _id: string;
  application?: { _id: string };
  applicant: { displayName: string; email: string };
  pet: { name: string };
  scheduledDate: string;
  method: string;
  status: string;
  result: string;
}

export default function Interviews() {
  const list = useResourceList<Interview>("/api/interviews");
  const applications = useApplications();
  const { showToast } = useToast();
  const [completing, setCompleting] = useState<Interview | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<"passed" | "failed">("passed");
  const [notes, setNotes] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [method, setMethod] = useState("In-person");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<Interview>[] = [
    { key: "applicant", header: "Applicant", accessor: (i) => i.applicant?.displayName },
    { key: "pet", header: "Pet", accessor: (i) => i.pet?.name },
    { key: "scheduledDate", header: "Scheduled", accessor: (i) => new Date(i.scheduledDate).toLocaleString() },
    { key: "method", header: "Method", accessor: (i) => i.method },
    { key: "status", header: "Status", accessor: (i) => <StatusBadge status={i.status} /> },
  ];

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!applicationId || !scheduledDate) {
      setError("Application and scheduled date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/interviews", { application: applicationId, scheduledDate, method, location: location || undefined });
      showToast("Interview scheduled", "success");
      setCreating(false);
      setApplicationId("");
      setScheduledDate("");
      setLocation("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to schedule interview"));
    } finally {
      setSaving(false);
    }
  }

  async function submitComplete() {
    if (!completing) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/interviews/${completing._id}/complete`, { result, notes });
      showToast("Interview marked complete", "success");
      setCompleting(null);
      setNotes("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to record interview result"));
    } finally {
      setSaving(false);
    }
  }

  const selectableApplications = applications.rows.filter((a) => a.status === "pending" && a.stage === "document_review");

  return (
    <div>
      <PageHeader
        title="Adoption Interviews"
        description="Schedule interviews and record outcomes."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Schedule interview</Button>}
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(i) => i._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No interviews scheduled"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: ["scheduled", "completed", "cancelled", "no-show"].map((s) => ({ value: s, label: s })) }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(i) =>
          i.status === "scheduled" ? (
            <Button variant="secondary" onClick={() => setCompleting(i)}>Record result</Button>
          ) : null
        }
      />

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title="Schedule interview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="create-interview-form" loading={saving}>Schedule</Button>
          </>
        }
      >
        <form id="create-interview-form" onSubmit={submitCreate}>
          {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
          <FormField label="Application" htmlFor="interview-application">
            <Select id="interview-application" required value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">Select an application</option>
              {selectableApplications.map((a) => <option key={a._id} value={a._id}>{a.applicant?.displayName} — {a.pet?.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Date & time" htmlFor="interview-date">
            <Input id="interview-date" type="datetime-local" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </FormField>
          <FormField label="Method" htmlFor="interview-method">
            <Select id="interview-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>In-person</option><option>Video call</option><option>Phone call</option>
            </Select>
          </FormField>
          <FormField label="Location (optional)" htmlFor="interview-location">
            <Input id="interview-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </FormField>
        </form>
      </Modal>

      <Modal
        isOpen={!!completing}
        onClose={() => setCompleting(null)}
        title="Record interview result"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleting(null)} disabled={saving}>Cancel</Button>
            <Button onClick={submitComplete} loading={saving}>Save result</Button>
          </>
        }
      >
        {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
        <div className="mb-4 flex gap-2">
          <Button variant={result === "passed" ? "primary" : "secondary"} onClick={() => setResult("passed")} type="button"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Passed</Button>
          <Button variant={result === "failed" ? "danger" : "secondary"} onClick={() => setResult("failed")} type="button"><XCircle className="h-4 w-4" aria-hidden="true" /> Failed</Button>
        </div>
        <TextArea rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Modal>
    </div>
  );
}
