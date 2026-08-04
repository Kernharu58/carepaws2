import { useState } from "react";
import { CheckCircle2, XCircle, FileText } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { useToast } from "../context/ToastContext";

interface UserDocument {
  _id: string;
  user: { displayName: string; email: string };
  type: string;
  fileUrl: string;
  status: string;
  createdAt: string;
}

export default function DocumentReview() {
  const list = useResourceList<UserDocument>("/api/documents");
  const { showToast } = useToast();
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function verify(doc: UserDocument, status: "verified" | "rejected") {
    setActingOn(doc._id);
    try {
      await api.put(`/api/documents/${doc._id}/verify`, { status });
      showToast(`Document ${status}`, "success");
      list.reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update document"), "error");
    } finally {
      setActingOn(null);
    }
  }

  const columns: Column<UserDocument>[] = [
    { key: "user", header: "Applicant", accessor: (d) => d.user?.displayName },
    { key: "type", header: "Document type", accessor: (d) => <span className="capitalize">{d.type.replace(/_/g, " ")}</span> },
    {
      key: "fileUrl",
      header: "File",
      accessor: (d) => (
        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" /> View
        </a>
      ),
    },
    { key: "status", header: "Status", accessor: (d) => <StatusBadge status={d.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Document Review" description="Verify uploaded identity and adoption documents." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(d) => d._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No documents to review"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: [{ value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }] }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(d) =>
          d.status === "pending" ? (
            <div className="flex justify-end gap-1">
              <button
                type="button"
                disabled={actingOn === d._id}
                onClick={() => verify(d, "verified")}
                className="rounded-lg p-1.5 text-status-success hover:bg-status-successBg disabled:opacity-50"
                aria-label="Verify document"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={actingOn === d._id}
                onClick={() => verify(d, "rejected")}
                className="rounded-lg p-1.5 text-status-danger hover:bg-status-dangerBg disabled:opacity-50"
                aria-label="Reject document"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ) : null
        }
      />
    </div>
  );
}
