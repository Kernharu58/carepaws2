import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useState } from "react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import TextArea from "../components/ui/TextArea";

interface Feedback {
  _id: string;
  submittedBy: { displayName: string };
  type: string;
  rating?: number;
  subject: string;
  message: string;
  status: string;
}

export default function FeedbackReviews() {
  const list = useResourceList<Feedback>("/api/feedback");
  const { showToast } = useToast();
  const [responding, setResponding] = useState<Feedback | null>(null);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  const columns: Column<Feedback>[] = [
    { key: "submittedBy", header: "From", accessor: (f) => f.submittedBy?.displayName },
    { key: "type", header: "Type", accessor: (f) => <span className="capitalize">{f.type}</span> },
    { key: "subject", header: "Subject", accessor: (f) => f.subject },
    { key: "rating", header: "Rating", accessor: (f) => (f.rating ? `${f.rating}/5` : "—") },
    { key: "status", header: "Status", accessor: (f) => <StatusBadge status={f.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Feedback & Reviews" description="Respond to feedback, complaints, and reviews." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(f) => f._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No feedback yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "type", label: "Type", options: ["general", "complaint", "review", "suggestion"].map((t) => ({ value: t, label: t })) }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(f) => (
          <Button variant="secondary" onClick={() => setResponding(f)}>
            Respond
          </Button>
        )}
      />

      <Modal
        isOpen={!!responding}
        onClose={() => setResponding(null)}
        title="Respond to feedback"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResponding(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={async () => {
                if (!responding) return;
                setSaving(true);
                try {
                  await api.put(`/api/feedback/${responding._id}`, { adminResponse: response, status: "responded" });
                  showToast("Response sent", "success");
                  setResponding(null);
                  setResponse("");
                  list.reload();
                } catch (err) {
                  showToast(getApiErrorMessage(err, "Failed to send response"), "error");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Send response
            </Button>
          </>
        }
      >
        <p className="mb-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{responding?.message}</p>
        <TextArea rows={4} placeholder="Your response…" value={response} onChange={(e) => setResponse(e.target.value)} />
      </Modal>
    </div>
  );
}
