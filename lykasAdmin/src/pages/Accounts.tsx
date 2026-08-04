import { useState } from "react";
import { Ban, ShieldCheck, Trash2 } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface AccountRow {
  _id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function Accounts() {
  const list = useResourceList<AccountRow>("/api/auth/users");
  const { showToast } = useToast();
  const { hasRole } = useAuth();
  const [suspending, setSuspending] = useState<AccountRow | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<AccountRow>[] = [
    { key: "displayName", header: "Name", accessor: (u) => u.displayName },
    { key: "email", header: "Email", accessor: (u) => u.email },
    { key: "role", header: "Role", accessor: (u) => <span className="capitalize">{u.role.replace(/_/g, " ")}</span> },
    { key: "status", header: "Status", accessor: (u) => <StatusBadge status={u.status} /> },
    { key: "createdAt", header: "Joined", accessor: (u) => new Date(u.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title="Manage Accounts" description="All user accounts across the platform." />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(u) => u._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No accounts found"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        searchPlaceholder="Search by name or email…"
        filters={[
          { key: "role", label: "Role", options: [{ value: "user", label: "User" }, { value: "staff", label: "Staff" }, { value: "admin", label: "Admin" }, { value: "super_admin", label: "Super Admin" }] },
          { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "locked", label: "Locked" }] },
        ]}
        filterValues={list.filters}
        onFilterChange={list.onFilterChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
        rowActions={(u) => (
          <div className="flex justify-end gap-1">
            {u.status === "active" ? (
              <button
                type="button"
                onClick={() => setSuspending(u)}
                className="rounded-lg p-1.5 text-status-danger hover:bg-status-dangerBg"
                aria-label={`Suspend ${u.displayName}`}
              >
                <Ban className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await api.put(`/api/auth/users/${u._id}/status`, { status: "active" });
                  showToast("Account reactivated", "success");
                  list.reload();
                }}
                className="rounded-lg p-1.5 text-status-success hover:bg-status-successBg"
                aria-label={`Reactivate ${u.displayName}`}
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}
            {hasRole("super_admin") && (
              <button
                type="button"
                onClick={async () => {
                  await api.delete(`/api/auth/users/${u._id}`);
                  showToast("Account archived", "success");
                  list.reload();
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label={`Archive ${u.displayName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!suspending}
        title="Suspend this account?"
        message={`${suspending?.displayName} will lose access immediately and all active sessions will be revoked.`}
        confirmLabel="Suspend"
        variant="danger"
        loading={saving}
        onConfirm={async () => {
          if (!suspending) return;
          setSaving(true);
          try {
            await api.put(`/api/auth/users/${suspending._id}/status`, { status: "suspended" });
            showToast("Account suspended", "success");
            list.reload();
          } catch (err) {
            showToast(getApiErrorMessage(err, "Failed to suspend account"), "error");
          } finally {
            setSaving(false);
            setSuspending(null);
          }
        }}
        onCancel={() => setSuspending(null)}
      />
    </div>
  );
}
