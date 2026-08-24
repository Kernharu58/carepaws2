import { useEffect, useState } from "react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { Select } from "../components/ui/FormUI";
import { useToast } from "../context/ToastContext";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import TextArea from "../components/ui/TextArea";

interface EmergencyReport {
  _id: string;
  type: string;
  animalType?: string;
  description?: string;
  location?: string;
  photos?: string[];
  priority: string;
  status: string;
  assignedTo?: { _id: string; displayName: string } | null;
  resolutionNote?: string;
  createdAt: string;
}
interface StaffUser { _id: string; displayName: string; role: string; status: string; }

export default function EmergencyReports() {
  const list = useResourceList<EmergencyReport>("/api/emergency-reports");
  const { showToast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmergencyReport | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  useEffect(() => {
    api.get("/api/auth/users", { params: { role: "staff", limit: 100 } }).then((res) => setStaff(res.data.data || [])).catch(() => {});
  }, []);

  async function updateReport(reportId: string, payload: Record<string, unknown>, success = "Report updated") {
    setUpdating(reportId);
    try {
      await api.put(`/api/emergency-reports/${reportId}`, payload);
      showToast(success, "success");
      setSelected(null);
      list.reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update report"), "error");
    } finally { setUpdating(null); }
  }

  const columns: Column<EmergencyReport>[] = [
    { key: "type", header: "Type", accessor: (r) => <span className="capitalize">{r.type.replace(/_/g, " ")}</span> },
    { key: "animalType", header: "Animal", accessor: (r) => r.animalType || "—" },
    { key: "location", header: "Location", accessor: (r) => r.location || "—" },
    { key: "priority", header: "Priority", accessor: (r) => <StatusBadge status={r.priority} tone={r.priority === "critical" || r.priority === "high" ? "danger" : "warning"} /> },
    { key: "status", header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "assignedTo", header: "Assigned", accessor: (r) => r.assignedTo?.displayName || "Unassigned" },
    { key: "createdAt", header: "Reported", accessor: (r) => new Date(r.createdAt).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title="Emergency Reports" description="Stray, injured, and abuse reports from the public and staff." />
      <DataTable
        columns={columns} rows={list.rows} rowKey={(r) => r._id} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No emergency reports"
        searchValue={list.search} onSearchChange={list.onSearchChange}
        filters={[{ key: "priority", label: "Priority", options: ["low", "medium", "high", "critical"].map((p) => ({ value: p, label: p })) }, { key: "status", label: "Status", options: ["open", "in_progress", "resolved", "dismissed"].map((s) => ({ value: s, label: s })) }]}
        filterValues={list.filters} onFilterChange={list.onFilterChange} page={list.pagination.page} pages={list.pagination.pages} total={list.pagination.total} onPageChange={list.setPage}
        rowActions={(r) => <div className="flex items-center gap-2"><Select value={r.status} disabled={updating === r._id} onChange={(e) => updateReport(r._id, { status: e.target.value })} className="w-auto text-xs" aria-label="Update status"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></Select><Button variant="secondary" onClick={() => { setSelected(r); setAssignedTo(r.assignedTo?._id || ""); setResolutionNote(r.resolutionNote || ""); }}>Review</Button></div>}
      />

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review emergency report" footer={<><Button variant="secondary" onClick={() => setSelected(null)} disabled={!!updating}>Cancel</Button><Button loading={!!updating} onClick={() => selected && updateReport(selected._id, { assignedTo: assignedTo || undefined, resolutionNote: resolutionNote || undefined }, "Emergency report saved")}>Save</Button></>}>
        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700"><p className="font-semibold">{selected?.type?.replace(/_/g, " ")}</p><p className="mt-1">{selected?.description || "No description"}</p><p className="mt-1">{selected?.location || "No location"}</p></div>
          {!!selected?.photos?.length && <div className="flex gap-2 overflow-x-auto">{selected.photos.map((url) => <img key={url} src={url} alt="Emergency report" className="h-20 w-20 rounded-lg object-cover" />)}</div>}
          <label className="block text-sm font-medium text-gray-700">Assign staff</label>
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full"><option value="">Unassigned</option>{staff.filter((u) => u.status === "active").map((u) => <option key={u._id} value={u._id}>{u.displayName}</option>)}</Select>
          <label className="block text-sm font-medium text-gray-700">Resolution / response note</label>
          <TextArea rows={4} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="Record the response or resolution details…" />
        </div>
      </Modal>
    </div>
  );
}
