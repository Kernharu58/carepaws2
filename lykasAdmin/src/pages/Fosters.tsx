import { useResourceList } from "../hooks/useResourceList";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";

interface Foster {
  _id: string;
  pet: { name: string };
  fosterer: { displayName: string };
  startDate: string;
  status: string;
  weeklyReportsSubmitted: number;
  weeklyReportsRequired: number;
}

export default function Fosters() {
  const list = useResourceList<Foster>("/api/foster");

  const columns: Column<Foster>[] = [
    { key: "pet", header: "Pet", accessor: (f) => f.pet?.name },
    { key: "fosterer", header: "Fosterer", accessor: (f) => f.fosterer?.displayName },
    { key: "startDate", header: "Started", accessor: (f) => new Date(f.startDate).toLocaleDateString() },
    { key: "reports", header: "Weekly reports", accessor: (f) => `${f.weeklyReportsSubmitted}/${f.weeklyReportsRequired}` },
    { key: "status", header: "Status", accessor: (f) => <StatusBadge status={f.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Foster Management" description="Active and past foster placements." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(f) => f._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No foster placements yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }] }]}
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
