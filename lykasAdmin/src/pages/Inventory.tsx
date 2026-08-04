import { useState } from "react";
import { Plus, PackagePlus } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import Button from "../components/ui/Button";
import DataTable, { type Column } from "../components/ui/DataTable";
import Modal from "../components/ui/Modal";
import Alert from "../components/ui/Alert";
import { FormField, Input, Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
}

export default function Inventory() {
  const list = useResourceList<InventoryItem>("/api/inventory");
  const { showToast } = useToast();
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<"restock" | "usage">("restock");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<InventoryItem>[] = [
    { key: "name", header: "Item", accessor: (i) => <span className="font-medium text-gray-900">{i.name}</span> },
    { key: "category", header: "Category", accessor: (i) => i.category },
    {
      key: "quantity",
      header: "Quantity",
      accessor: (i) => (
        <span className={i.quantity <= i.minThreshold ? "font-semibold text-status-danger" : ""}>
          {i.quantity} {i.unit}
          {i.quantity <= i.minThreshold && " (low)"}
        </span>
      ),
    },
    { key: "minThreshold", header: "Min threshold", accessor: (i) => `${i.minThreshold} ${i.unit}` },
  ];

  async function submitAdjustment() {
    if (!adjusting) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/inventory/${adjusting._id}/adjust`, {
        type: adjustType,
        quantity: Number(adjustQty),
        note: adjustNote,
      });
      showToast("Inventory updated", "success");
      setAdjusting(null);
      setAdjustQty("");
      setAdjustNote("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to adjust inventory"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Inventory" description="Track shelter supplies and stock levels." />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(i) => i._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No inventory items yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        searchPlaceholder="Search items…"
        filters={[
          {
            key: "category",
            label: "Category",
            options: ["food", "medical", "bedding", "cleaning", "equipment", "office", "other"].map((c) => ({ value: c, label: c })),
          },
        ]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(item) => (
          <Button
            variant="secondary"
            onClick={() => {
              setAdjusting(item);
              setAdjustType("restock");
            }}
          >
            <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            Adjust
          </Button>
        )}
      />

      <Modal
        isOpen={!!adjusting}
        onClose={() => setAdjusting(null)}
        title={`Adjust stock — ${adjusting?.name ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitAdjustment} loading={saving}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Apply
            </Button>
          </>
        }
      >
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <FormField label="Type" htmlFor="adjust-type">
          <Select id="adjust-type" value={adjustType} onChange={(e) => setAdjustType(e.target.value as "restock" | "usage")}>
            <option value="restock">Restock (add)</option>
            <option value="usage">Usage (remove)</option>
          </Select>
        </FormField>
        <FormField label="Quantity" htmlFor="adjust-qty">
          <Input id="adjust-qty" type="number" min={0} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
        </FormField>
        <FormField label="Note" htmlFor="adjust-note">
          <Input id="adjust-note" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
        </FormField>
      </Modal>
    </div>
  );
}
