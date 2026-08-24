import { useState } from "react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";

interface InKindDonation {
  _id: string;
  name: string;
  quantity?: number;
  unit?: string;
  donatedBy?: { displayName: string };
  dropOff: string;
  status: string;
  inventoryProcessedAt?: string | null;
}

export default function GoodsDonations() {
  const list = useResourceList<InKindDonation>("/api/donations/goods");
  const { showToast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateStatus(donation: InKindDonation, status: string) {
    setUpdating(donation._id);
    try {
      await api.patch(`/api/donations/goods/${donation._id}/status`, { status });
      showToast("Donation status updated", "success");
      list.reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update donation"), "error");
    } finally {
      setUpdating(null);
    }
  }

  const columns: Column<InKindDonation>[] = [
    { key: "name", header: "Item", accessor: (d) => d.name },
    { key: "quantity", header: "Quantity", accessor: (d) => (d.quantity ? `${d.quantity} ${d.unit ?? ""}` : "—") },
    { key: "donatedBy", header: "Donor", accessor: (d) => d.donatedBy?.displayName || "Anonymous" },
    { key: "dropOff", header: "Drop-off", accessor: (d) => <span className="capitalize">{d.dropOff.replace(/_/g, " ")}</span> },
    { key: "status", header: "Status", accessor: (d) => <StatusBadge status={d.status} /> },
    { key: "inventory", header: "Inventory", accessor: (d) => d.inventoryProcessedAt ? "Synced" : "Not received" },
  ];

  return (
    <div>
      <PageHeader title="Goods Donations" description="In-kind donation intake and status tracking." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(d) => d._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No in-kind donations yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: ["pending", "confirmed", "received", "cancelled"].map((s) => ({ value: s, label: s })) }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(d) => (
          <Select
            value={d.status}
            disabled={updating === d._id}
            onChange={(e) => updateStatus(d, e.target.value)}
            className="w-auto text-xs"
            aria-label={`Update status for ${d.name}`}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        )}
      />
    </div>
  );
}
