import { useState, type FormEvent } from "react";
import { History, Pencil, Plus, PackagePlus } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import Button from "../components/ui/Button";
import DataTable, { type Column } from "../components/ui/DataTable";
import Modal from "../components/ui/Modal";
import Alert from "../components/ui/Alert";
import { FormField, Input, Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";

interface InventoryMovement {
  _id: string;
  type: "restock" | "usage" | "adjustment";
  quantity: number;
  note?: string;
  sourceType?: string;
  createdAt: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  location?: string;
  supplier?: string;
  notes?: string;
}

const CATEGORIES = ["food", "medical", "bedding", "cleaning", "equipment", "office", "other"];

export default function Inventory() {
  const list = useResourceList<InventoryItem>("/api/inventory");
  const { showToast } = useToast();
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [adjustType, setAdjustType] = useState<"restock" | "usage" | "adjustment">("restock");
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("food");
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("");
  const [minThreshold, setMinThreshold] = useState("0");
  const [location, setLocation] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
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

  function openCreate() {
    setEditing(null);
    setName("");
    setCategory("food");
    setQuantity("0");
    setUnit("");
    setMinThreshold("0");
    setLocation("");
    setSupplier("");
    setNotes("");
    setError(null);
    setCreating(true);
  }

  function openEdit(item: InventoryItem) {
    setCreating(false);
    setEditing(item);
    setName(item.name);
    setCategory(item.category);
    setQuantity(String(item.quantity));
    setUnit(item.unit || "");
    setMinThreshold(String(item.minThreshold));
    setLocation(item.location || "");
    setSupplier(item.supplier || "");
    setNotes(item.notes || "");
    setError(null);
  }

  async function submitItem(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        category,
        ...(editing ? {} : { quantity: Number(quantity) }),
        unit,
        minThreshold: Number(minThreshold),
        location: location || undefined,
        supplier: supplier || undefined,
        notes: notes || undefined,
      };
      if (editing) {
        await api.put(`/api/inventory/${editing._id}`, body);
        showToast("Inventory item updated", "success");
      } else {
        await api.post("/api/inventory", body);
        showToast("Inventory item added", "success");
      }
      setCreating(false);
      setEditing(null);
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, editing ? "Failed to update inventory item" : "Failed to add inventory item"));
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(item: InventoryItem) {
    setHistoryItem(item);
    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/inventory/${item._id}/movements`);
      setMovements(response.data?.data ?? []);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to load inventory history"), "error");
      setHistoryItem(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitAdjustment() {
    if (!adjusting) return;
    const qty = Number(adjustQty);
    if (!Number.isFinite(qty) || (adjustType !== "adjustment" && qty <= 0) || (adjustType === "adjustment" && qty === 0)) {
      setError(adjustType === "adjustment" ? "Enter a non-zero adjustment." : "Enter a quantity greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/inventory/${adjusting._id}/adjust`, {
        type: adjustType,
        quantity: qty,
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
      <PageHeader
        title="Inventory"
        description="Track shelter supplies and stock levels."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" aria-hidden="true" /> Add item</Button>}
      />

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
        filters={[{ key: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c })) }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(item) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" onClick={() => openHistory(item)} aria-label={`View history for ${item.name}`}><History className="h-3.5 w-3.5" /></Button>
            <Button variant="secondary" onClick={() => { setAdjusting(item); setAdjustType("restock"); setError(null); }}>
              <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" /> Adjust
            </Button>
          </div>
        )}
      />

      <Modal
        isOpen={creating || !!editing}
        onClose={() => { if (!saving) { setCreating(false); setEditing(null); } }}
        title={editing ? `Edit ${editing.name}` : "Add inventory item"}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }} disabled={saving}>Cancel</Button>
            <Button type="submit" form="inventory-item-form" loading={saving}>{editing ? "Save changes" : "Add item"}</Button>
          </>
        }
      >
        <form id="inventory-item-form" onSubmit={submitItem}>
          {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
          <FormField label="Item name" htmlFor="inventory-name"><Input id="inventory-name" required value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category" htmlFor="inventory-category">
              <Select id="inventory-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
            <FormField label="Unit" htmlFor="inventory-unit"><Input id="inventory-unit" value={unit} onChange={(e) => setUnit(e.target.value)} /></FormField>
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Starting quantity" htmlFor="inventory-quantity"><Input id="inventory-quantity" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></FormField>
              <FormField label="Minimum threshold" htmlFor="inventory-min"><Input id="inventory-min" type="number" min={0} value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} /></FormField>
            </div>
          )}
          {editing && <FormField label="Minimum threshold" htmlFor="inventory-min"><Input id="inventory-min" type="number" min={0} value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} /></FormField>}
          <FormField label="Location" htmlFor="inventory-location"><Input id="inventory-location" value={location} onChange={(e) => setLocation(e.target.value)} /></FormField>
          <FormField label="Supplier" htmlFor="inventory-supplier"><Input id="inventory-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></FormField>
          <FormField label="Notes" htmlFor="inventory-notes"><Input id="inventory-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
        </form>
      </Modal>

      <Modal
        isOpen={!!adjusting}
        onClose={() => setAdjusting(null)}
        title={`Adjust stock — ${adjusting?.name ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)} disabled={saving}>Cancel</Button>
            <Button onClick={submitAdjustment} loading={saving}>Apply</Button>
          </>
        }
      >
        {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
        <FormField label="Type" htmlFor="adjust-type">
          <Select id="adjust-type" value={adjustType} onChange={(e) => setAdjustType(e.target.value as "restock" | "usage" | "adjustment")}>
            <option value="restock">Restock (add)</option><option value="usage">Usage (remove)</option><option value="adjustment">Adjustment (+/-)</option>
          </Select>
        </FormField>
        <FormField label="Quantity" htmlFor="adjust-qty"><Input id="adjust-qty" type="number" min={adjustType === "adjustment" ? undefined : 1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} /></FormField>
        {adjustType === "adjustment" && <p className="text-xs text-gray-500 -mt-2 mb-3">Use a positive number to add stock or a negative number to reduce it.</p>}
        <FormField label="Note" htmlFor="adjust-note"><Input id="adjust-note" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} /></FormField>
      </Modal>

      <Modal
        isOpen={!!historyItem}
        onClose={() => setHistoryItem(null)}
        title={`Transaction history — ${historyItem?.name ?? ""}`}
        footer={<Button variant="secondary" onClick={() => setHistoryItem(null)}>Close</Button>}
      >
        {historyLoading ? (
          <p className="text-sm text-gray-500">Loading history…</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-gray-500">No stock transactions recorded.</p>
        ) : (
          <div className="space-y-3">
            {movements.map((movement) => (
              <div key={movement._id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium capitalize">{movement.type}</span>
                  <span className={movement.type === "usage" || (movement.type === "adjustment" && movement.quantity < 0) ? "text-status-danger" : "text-status-success"}>
                    {movement.type === "usage" ? "-" : movement.type === "adjustment" && movement.quantity > 0 ? "+" : ""}{movement.quantity} {historyItem?.unit ?? ""}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{new Date(movement.createdAt).toLocaleString()} · {movement.sourceType === "inkind_donation" ? "In-kind donation" : "Manual"}</div>
                {movement.note && <div className="mt-1 text-xs text-gray-600">{movement.note}</div>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
