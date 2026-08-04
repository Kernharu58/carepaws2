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
import TextArea from "../components/ui/TextArea";
import { useToast } from "../context/ToastContext";

interface EventRow {
  _id: string;
  title: string;
  category: string;
  date: string;
  location: string;
  status: string;
  currentAttendees: number;
  maxAttendees?: number;
}

export default function Events() {
  const list = useResourceList<EventRow>("/api/events");
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Community");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<EventRow>[] = [
    { key: "title", header: "Event", accessor: (e) => <span className="font-medium text-gray-900">{e.title}</span> },
    { key: "category", header: "Category", accessor: (e) => e.category },
    { key: "date", header: "Date", accessor: (e) => new Date(e.date).toLocaleDateString() },
    { key: "location", header: "Location", accessor: (e) => e.location || "—" },
    { key: "attendees", header: "Attendees", accessor: (e) => `${e.currentAttendees}${e.maxAttendees ? `/${e.maxAttendees}` : ""}` },
    { key: "status", header: "Status", accessor: (e) => <StatusBadge status={e.status} /> },
  ];

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/events", { title, category, date, location, description });
      showToast("Event created", "success");
      setCreating(false);
      setTitle("");
      setDate("");
      setLocation("");
      setDescription("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create event"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Events"
        description="Adoption drives, fundraisers, and community events."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> New event
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(e) => e._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No events yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        filters={[{ key: "status", label: "Status", options: ["upcoming", "ongoing", "completed", "cancelled"].map((s) => ({ value: s, label: s })) }]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
      />

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title="New event"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="create-event-form" loading={saving}>
              Create
            </Button>
          </>
        }
      >
        <form id="create-event-form" onSubmit={handleCreate}>
          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <FormField label="Title" htmlFor="ev-title">
            <Input id="ev-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Category" htmlFor="ev-category">
            <Select id="ev-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Adoption Drive">Adoption Drive</option>
              <option value="Fundraiser">Fundraiser</option>
              <option value="Training">Training</option>
              <option value="Community">Community</option>
              <option value="Volunteer">Volunteer</option>
              <option value="Other">Other</option>
            </Select>
          </FormField>
          <FormField label="Date" htmlFor="ev-date">
            <Input id="ev-date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="Location" htmlFor="ev-location">
            <Input id="ev-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </FormField>
          <FormField label="Description" htmlFor="ev-description">
            <TextArea id="ev-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
