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

interface HomeVisit {
  _id: string;
  applicant: { displayName: string };
  pet: { name: string };
  scheduledDate: string;
  status: string;
  result: string;
}

export default function HomeVisits() {
  const list = useResourceList<HomeVisit>("/api/home-visits");
  const applications = useApplications();
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<HomeVisit | null>(null);
  const [result, setResult] = useState<"passed" | "failed">("passed");
  const [completionNotes, setCompletionNotes] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<HomeVisit>[] = [
    { key: "applicant", header: "Applicant", accessor: (v) => v.applicant?.displayName },
    { key: "pet", header: "Pet", accessor: (v) => v.pet?.name },
    { key: "scheduledDate", header: "Scheduled", accessor: (v) => new Date(v.scheduledDate).toLocaleString() },
    { key: "status", header: "Status", accessor: (v) => <StatusBadge status={v.status} /> },
    { key: "result", header: "Result", accessor: (v) => <StatusBadge status={v.result} /> },
  ];

  async function createVisit(e: FormEvent) {
    e.preventDefault();
    if (!applicationId || !scheduledDate) {
      setError("Application and scheduled date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/home-visits", { application: applicationId, scheduledDate, address: address || undefined });
      showToast("Home visit scheduled", "success");
      setCreating(false);
      setApplicationId("");
      setScheduledDate("");
      setAddress("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to schedule home visit"));
    } finally {
      setSaving(false);
    }
  }

  async function completeVisit(e?: FormEvent) {
    e?.preventDefault();
    if (!completing) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/home-visits/${completing._id}/complete`, { result, notes: completionNotes });
      showToast("Home visit completed", "success");
      setCompleting(null);
      setCompletionNotes("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to record home visit result"));
    } finally {
      setSaving(false);
    }
  }

  const selectableApplications = applications.rows.filter((a) => a.status === "pending" && a.stage === "home_visit");

  return (
    <div>
      <PageHeader
        title="Home Visits"
        description="Track scheduled and completed home visits."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Schedule home visit</Button>}
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(v) => v._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No home visits scheduled"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: ["scheduled", "completed", "cancelled", "rescheduled", "no-show"].map((s) => ({ value: s, label: s })) }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(visit) =>
          visit.status === "scheduled" ? (
            <Button variant="secondary" onClick={() => setCompleting(visit)}>Record result</Button>
          ) : null
        }
      />

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title="Schedule home visit"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="create-home-visit-form" loading={saving}>Schedule</Button>
          </>
        }
      >
        <form id="create-home-visit-form" onSubmit={createVisit}>
          {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
          <FormField label="Application" htmlFor="home-application">
            <Select id="home-application" required value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">Select an application</option>
              {selectableApplications.map((a) => <option key={a._id} value={a._id}>{a.applicant?.displayName} — {a.pet?.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Date & time" htmlFor="home-date">
            <Input id="home-date" type="datetime-local" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </FormField>
          <FormField label="Address (optional)" htmlFor="home-address">
            <Input id="home-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </FormField>
        </form>
      </Modal>

<Modal
        isOpen={!!completing}
        onClose={() => setCompleting(null)}
        title="Record home visit result"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleting(null)} disabled={saving}>Cancel</Button>
            <Button onClick={() => completeVisit()} loading={saving}>Save result</Button>
          </>
        }
      >
        {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
        <form onSubmit={completeVisit}>
          <FormField label="Result" htmlFor="home-result">
            <Select id="home-result" value={result} onChange={(e) => setResult(e.target.value as "passed" | "failed")}>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </Select>
          </FormField>
          <FormField label="Notes" htmlFor="home-completion-notes">
            <Input id="home-completion-notes" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
