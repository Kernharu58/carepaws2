import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { useResourceList } from "../hooks/useResourceList";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Alert from "../components/ui/Alert";
import { FormField, Input } from "../components/ui/FormUI";
import TextArea from "../components/ui/TextArea";
import { useToast } from "../context/ToastContext";

interface NotificationRow {
  _id: string;
  recipient: { displayName: string; email: string };
  type: string;
  title: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsAdmin() {
  const list = useResourceList<NotificationRow>("/api/notifications/admin");
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<NotificationRow>[] = [
    { key: "recipient", header: "Recipient", accessor: (n) => n.recipient?.displayName },
    { key: "type", header: "Type", accessor: (n) => <span className="text-xs">{n.type.replace(/_/g, " ")}</span> },
    { key: "title", header: "Title", accessor: (n) => n.title },
    { key: "isRead", header: "Read?", accessor: (n) => (n.isRead ? "Yes" : "No") },
    { key: "createdAt", header: "Sent", accessor: (n) => new Date(n.createdAt).toLocaleString() },
  ];

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Resolve the recipient by email via the admin user list first.
      const userRes = await api.get("/api/auth/users", { params: { q: recipientEmail, limit: 1 } });
      const recipient = userRes.data.data[0];
      if (!recipient) throw new Error("No user found with that email");

      await api.post("/api/notifications/send", {
        recipientIds: [recipient._id],
        type: "GENERAL",
        title,
        message,
      });
      showToast("Notification sent", "success");
      setSending(false);
      setRecipientEmail("");
      setTitle("");
      setMessage("");
      list.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to send notification"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications Management"
        description="Sent notifications across the platform."
        actions={
          <Button onClick={() => setSending(true)}>
            <Send className="h-4 w-4" aria-hidden="true" /> Send notification
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(n) => n._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No notifications sent yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
      />

      <Modal
        isOpen={sending}
        onClose={() => setSending(false)}
        title="Send a notification"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSending(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="send-notification-form" loading={saving}>
              Send
            </Button>
          </>
        }
      >
        <form id="send-notification-form" onSubmit={handleSend}>
          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <FormField label="Recipient email" htmlFor="notif-recipient">
            <Input id="notif-recipient" type="email" required value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
          </FormField>
          <FormField label="Title" htmlFor="notif-title">
            <Input id="notif-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Message" htmlFor="notif-message">
            <TextArea id="notif-message" rows={3} required value={message} onChange={(e) => setMessage(e.target.value)} />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
