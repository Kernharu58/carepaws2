import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { Select } from "../components/ui/FormUI";
import TextArea from "../components/ui/TextArea";
import { useToast } from "../context/ToastContext";

interface Interview {
  _id: string;
  applicant: { displayName: string; email: string };
  pet: { name: string };
  scheduledDate: string;
  method: string;
  status: string;
  result: string;
}

export default function Interviews() {
  const list = useResourceList<Interview>("/api/interviews");
  const { showToast } = useToast();
  const [completing, setCompleting] = useState<Interview | null>(null);
  const [result, setResult] = useState<"passed" | "failed">("passed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<Interview>[] = [
    { key: "applicant", header: "Applicant", accessor: (i) => i.applicant?.displayName },
    { key: "pet", header: "Pet", accessor: (i) => i.pet?.name },
    { key: "scheduledDate", header: "Scheduled", accessor: (i) => new Date(i.scheduledDate).toLocaleString() },
    { key: "method", header: "Method", accessor: (i) => i.method },
    { key: "status", header: "Status", accessor: (i) => <StatusBadge status={i.status} /> },
  ];

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

  return (
    <div>
      <PageHeader title="Adoption Interviews" description="Track and record interview outcomes." />
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
            <Button variant="secondary" onClick={() => setCompleting(i)}>
              Record result
            </Button>
          ) : null
        }
      />

      <Modal
        isOpen={!!completing}
        onClose={() => setCompleting(null)}
        title="Record interview result"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitComplete} loading={saving}>
              Save result
            </Button>
          </>
        }
      >
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <div className="mb-4 flex gap-2">
          <Button variant={result === "passed" ? "primary" : "secondary"} onClick={() => setResult("passed")} type="button">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Passed
          </Button>
          <Button variant={result === "failed" ? "danger" : "secondary"} onClick={() => setResult("failed")} type="button">
            <XCircle className="h-4 w-4" aria-hidden="true" /> Failed
          </Button>
        </div>
        <TextArea rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Modal>
    </div>
  );
}
