import { useResourceList } from "../hooks/useResourceList";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";

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

  const columns: Column<HomeVisit>[] = [
    { key: "applicant", header: "Applicant", accessor: (v) => v.applicant?.displayName },
    { key: "pet", header: "Pet", accessor: (v) => v.pet?.name },
    { key: "scheduledDate", header: "Scheduled", accessor: (v) => new Date(v.scheduledDate).toLocaleString() },
    { key: "status", header: "Status", accessor: (v) => <StatusBadge status={v.status} /> },
    { key: "result", header: "Result", accessor: (v) => <StatusBadge status={v.result} /> },
  ];

  return (
    <div>
      <PageHeader title="Home Visits" description="Track scheduled and completed home visits." />
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
      />
    </div>
  );
}
