import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Alert from "../components/ui/Alert";
import { FormField, Input, Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";

interface Shelter {
  _id: string;
  name: string;
  type: string;
  status: string;
  capacity: number;
  currentOccupancy: number;
}

export default function ShelterManagement() {
  const list = useResourceList<Shelter>("/api/shelters");
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState("main_shelter");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<Shelter>[] = [
    { key: "name", header: "Name", accessor: (s) => s.name },
    { key: "type", header: "Type", accessor: (s) => <span className="capitalize">{s.type.replace(/_/g, " ")}</span> },
    { key: "occupancy", header: "Occupancy", accessor: (s) => `${s.currentOccupancy}/${s.capacity}` },
    { key: "status", header: "Status", accessor: (s) => <StatusBadge status={s.status} /> },
  ];

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/shelters", { name, address, type, capacity: Number(capacity) || 0 });
      showToast("Shelter added", "success");
      setCreating(false);
      setName("");
      setAddress("");
      setCapacity("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to add shelter"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Shelter Management"
        description="Physical shelter locations, foster hubs, and clinics."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add shelter
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(s) => s._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No shelters registered yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
      />

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title="Add a shelter"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-shelter-form" loading={saving}>
              Add shelter
            </Button>
          </>
        }
      >
        <form id="add-shelter-form" onSubmit={handleCreate}>
          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <FormField label="Name" htmlFor="shelter-name">
            <Input id="shelter-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Address" htmlFor="shelter-address">
            <Input id="shelter-address" required value={address} onChange={(e) => setAddress(e.target.value)} />
          </FormField>
          <FormField label="Type" htmlFor="shelter-type">
            <Select id="shelter-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="main_shelter">Main shelter</option>
              <option value="foster_hub">Foster hub</option>
              <option value="clinic">Clinic</option>
              <option value="satellite">Satellite</option>
            </Select>
          </FormField>
          <FormField label="Capacity" htmlFor="shelter-capacity">
            <Input id="shelter-capacity" type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
