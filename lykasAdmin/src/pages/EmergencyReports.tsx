import { useState } from "react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";

interface EmergencyReport {
  _id: string;
  type: string;
  animalType?: string;
  location?: string;
  priority: string;
  status: string;
  createdAt: string;
}

export default function EmergencyReports() {
  const list = useResourceList<EmergencyReport>("/api/emergency-reports");
  const { showToast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateStatus(report: EmergencyReport, status: string) {
    setUpdating(report._id);
    try {
      await api.put(`/api/emergency-reports/${report._id}`, { status });
      showToast("Report updated", "success");
      list.reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update report"), "error");
    } finally {
      setUpdating(null);
    }
  }

  const columns: Column<EmergencyReport>[] = [
    { key: "type", header: "Type", accessor: (r) => <span className="capitalize">{r.type.replace(/_/g, " ")}</span> },
    { key: "animalType", header: "Animal", accessor: (r) => r.animalType || "—" },
    { key: "location", header: "Location", accessor: (r) => r.location || "—" },
    { key: "priority", header: "Priority", accessor: (r) => <StatusBadge status={r.priority} tone={r.priority === "critical" || r.priority === "high" ? "danger" : "warning"} /> },
    { key: "status", header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", header: "Reported", accessor: (r) => new Date(r.createdAt).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title="Emergency Reports" description="Stray, injured, and abuse reports from the public and staff." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(r) => r._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No emergency reports"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[
          { key: "priority", label: "Priority", options: ["low", "medium", "high", "critical"].map((p) => ({ value: p, label: p })) },
          { key: "status", label: "Status", options: ["open", "in_progress", "resolved", "dismissed"].map((s) => ({ value: s, label: s })) },
        ]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(r) => (
          <Select
            value={r.status}
            disabled={updating === r._id}
            onChange={(e) => updateStatus(r, e.target.value)}
            className="w-auto text-xs"
            aria-label="Update status"
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </Select>
        )}
      />
    </div>
  );
}
