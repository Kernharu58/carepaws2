import { useState } from "react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import Button from "../components/ui/Button";
import VolunteerForm from "../components/Community/VolunteerForm";
import { useToast } from "../context/ToastContext";

interface VolunteerApplication {
  _id: string;
  user: { displayName: string; email: string };
  phone: string;
  motivation: string;
  status: string;
  totalHours: number;
}

export default function Volunteer() {
  const list = useResourceList<VolunteerApplication>("/api/volunteers");
  const { showToast } = useToast();
  const [reviewing, setReviewing] = useState<VolunteerApplication | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<VolunteerApplication>[] = [
    { key: "user", header: "Applicant", accessor: (v) => v.user?.displayName },
    { key: "phone", header: "Phone", accessor: (v) => v.phone },
    { key: "motivation", header: "Motivation", accessor: (v) => <span className="line-clamp-1 max-w-xs">{v.motivation}</span> },
    { key: "status", header: "Status", accessor: (v) => <StatusBadge status={v.status} /> },
    { key: "totalHours", header: "Hours logged", accessor: (v) => v.totalHours },
  ];

  return (
    <div>
      <PageHeader title="Volunteer Applications" description="Review and approve volunteer sign-ups." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(v) => v._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No volunteer applications yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: [{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "inactive", label: "Inactive" }] }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(v) =>
          v.status === "pending" ? (
            <Button variant="secondary" onClick={() => setReviewing(v)}>
              Review
            </Button>
          ) : null
        }
      />

      <VolunteerForm
        isOpen={!!reviewing}
        onClose={() => setReviewing(null)}
        submitting={saving}
        onSubmit={async (status, notes) => {
          if (!reviewing) return;
          setSaving(true);
          try {
            await api.put(`/api/volunteers/${reviewing._id}/status`, { status, notes });
            showToast(`Application ${status}`, "success");
            setReviewing(null);
            list.reload();
          } catch (err) {
            showToast(getApiErrorMessage(err, "Failed to update volunteer application"), "error");
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
