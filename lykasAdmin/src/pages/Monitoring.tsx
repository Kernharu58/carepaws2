import { useState } from "react";
import { CheckCircle2, Flag } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { useToast } from "../context/ToastContext";

interface MonitoringReport {
  _id: string;
  pet: { name: string };
  submittedBy: { displayName: string };
  reportDate: string;
  overallCondition: string;
  status: string;
}

export default function Monitoring() {
  const list = useResourceList<MonitoringReport>("/api/monitoring-reports");
  const { showToast } = useToast();
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function review(report: MonitoringReport, status: "reviewed" | "flagged") {
    setActingOn(report._id);
    try {
      await api.put(`/api/monitoring-reports/${report._id}/review`, { status });
      showToast(`Report marked ${status}`, "success");
      list.reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update report"), "error");
    } finally {
      setActingOn(null);
    }
  }

  const columns: Column<MonitoringReport>[] = [
    { key: "pet", header: "Pet", accessor: (r) => r.pet?.name },
    { key: "submittedBy", header: "Submitted by", accessor: (r) => r.submittedBy?.displayName },
    { key: "reportDate", header: "Date", accessor: (r) => new Date(r.reportDate).toLocaleDateString() },
    { key: "overallCondition", header: "Condition", accessor: (r) => r.overallCondition },
    { key: "status", header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Post-Adoption Monitoring" description="Review post-adoption check-ins from adopters." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(r) => r._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No monitoring reports yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: [{ value: "pending", label: "Pending" }, { value: "reviewed", label: "Reviewed" }, { value: "flagged", label: "Flagged" }] }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(r) =>
          r.status === "pending" ? (
            <div className="flex justify-end gap-1">
              <button
                type="button"
                disabled={actingOn === r._id}
                onClick={() => review(r, "reviewed")}
                className="rounded-lg p-1.5 text-status-success hover:bg-status-successBg disabled:opacity-50"
                aria-label="Mark reviewed"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={actingOn === r._id}
                onClick={() => review(r, "flagged")}
                className="rounded-lg p-1.5 text-status-danger hover:bg-status-dangerBg disabled:opacity-50"
                aria-label="Flag for follow-up"
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          ) : null
        }
      />
    </div>
  );
}
