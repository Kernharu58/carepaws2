import { useResourceList } from "../hooks/useResourceList";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";

interface Donation {
  _id: string;
  paidBy: { displayName: string };
  amount: number;
  status: string;
  createdAt: string;
}

export default function Donations() {
  const list = useResourceList<Donation>("/api/payments", { type: "donation" });

  const columns: Column<Donation>[] = [
    { key: "paidBy", header: "Donor", accessor: (d) => d.paidBy?.displayName },
    { key: "amount", header: "Amount", accessor: (d) => (d.amount / 100).toLocaleString(undefined, { style: "currency", currency: "PHP" }) },
    { key: "status", header: "Status", accessor: (d) => <StatusBadge status={d.status} /> },
    { key: "createdAt", header: "Date", accessor: (d) => new Date(d.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title="Donations" description="Cash donations received through the platform." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(d) => d._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No donations yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
      />
    </div>
  );
}
