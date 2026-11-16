import { useState } from "react";
import { Eye } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import IconButton from "../components/ui/IconButton";
import IdentityReviewModal from "../components/identity/IdentityReviewModal";
import { useToast } from "../context/ToastContext";
import { ID_TYPE_LABELS, type IdentityQueueRow } from "../types/identity";

/**
 * Identity verification queue. This page never changes an identity status
 * itself: every decision is a POST to the backend verification service, which
 * re-checks the reviewer's role, the document, the checklist and the status
 * transition. Email verification and per-application documents are separate
 * (see Document Review).
 */
export default function UserVerification() {
  const list = useResourceList<IdentityQueueRow>("/api/identity/queue");
  const { showToast } = useToast();
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const columns: Column<IdentityQueueRow>[] = [
    {
      key: "applicant",
      header: "Applicant",
      accessor: (r) => (
        <div>
          <p className="font-medium">{r.user?.displayName}</p>
          <p className="text-xs text-gray-500">{r.user?.email}</p>
        </div>
      ),
    },
    { key: "idType", header: "ID type", accessor: (r) => (r.idType ? ID_TYPE_LABELS[r.idType] ?? r.idType : "Legacy upload") },
    {
      key: "expiresAt",
      header: "Expiry",
      accessor: (r) => (
        <span className={r.isExpired ? "font-medium text-status-danger" : ""}>
          {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}
          {r.isExpired ? " (expired)" : ""}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Submitted",
      accessor: (r) => (
        <div>
          {new Date(r.createdAt).toLocaleDateString()}
          {r.isRenewal && <span className="ml-1 text-xs text-gray-500">renewal</span>}
          {r.submissionChannel === "staff_assisted" && <span className="ml-1 text-xs text-gray-500">walk-in</span>}
        </div>
      ),
    },
    { key: "status", header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Identity Verification"
        description="Review government IDs. This is a staff visual assessment, not a check against any government database. Email verification and application documents are separate."
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(r) => r._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No identity documents in this view"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "pending", label: "Pending review" },
              { value: "resubmission_required", label: "Resubmission required" },
              { value: "rejected", label: "Rejected" },
              { value: "expired", label: "Expired" },
              { value: "verified", label: "Verified" },
              { value: "all", label: "All" },
            ],
          },
        ]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(r) => (
          <div className="flex justify-end gap-1">
            <IconButton label={r.status === "pending" ? "Review ID" : "View ID record"} onClick={() => setReviewingId(r._id)}>
              <Eye className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      />
      <IdentityReviewModal
        documentId={reviewingId}
        onClose={() => setReviewingId(null)}
        onDecided={(message) => {
          showToast(message, "success");
          setReviewingId(null);
          list.reload();
        }}
      />
    </div>
  );
}
