import type { FormEvent } from "react";
import { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { FormField, Select } from "../ui/FormUI";
import TextArea from "../ui/TextArea";

interface VolunteerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (status: string, notes: string) => Promise<void>;
  submitting: boolean;
}

/** Staff-side review form for a pending volunteer application. */
export default function VolunteerForm({ isOpen, onClose, onSubmit, submitting }: VolunteerFormProps) {
  const [status, setStatus] = useState("approved");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(status, notes);
    setNotes("");
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review volunteer application"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="volunteer-review-form" loading={submitting}>
            Save decision
          </Button>
        </>
      }
    >
      <form id="volunteer-review-form" onSubmit={handleSubmit}>
        <FormField label="Decision" htmlFor="vf-status">
          <Select id="vf-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
          </Select>
        </FormField>
        <FormField label="Notes (optional)" htmlFor="vf-notes">
          <TextArea id="vf-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
