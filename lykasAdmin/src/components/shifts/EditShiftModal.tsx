import { useEffect, useState, type FormEvent } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { FormField, Input } from "../ui/FormUI";

interface Shift {
  _id: string;
  title: string;
  date: string;
  durationHours: number;
  capacity: number;
}

interface EditShiftModalProps {
  shift: Shift | null;
  onClose: () => void;
  onSubmit: (id: string, values: { title: string; durationHours: number; capacity: number }) => Promise<void>;
  submitting: boolean;
}

export default function EditShiftModal({ shift, onClose, onSubmit, submitting }: EditShiftModalProps) {
  const [title, setTitle] = useState("");
  const [durationHours, setDurationHours] = useState("2");
  const [capacity, setCapacity] = useState("1");

  useEffect(() => {
    if (shift) {
      setTitle(shift.title);
      setDurationHours(String(shift.durationHours));
      setCapacity(String(shift.capacity));
    }
  }, [shift]);

  if (!shift) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shift) return;
    await onSubmit(shift._id, { title, durationHours: Number(durationHours), capacity: Number(capacity) });
  }

  return (
    <Modal
      isOpen={!!shift}
      onClose={onClose}
      title="Edit shift"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-shift-form" loading={submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-shift-form" onSubmit={handleSubmit}>
        <FormField label="Title" htmlFor="edit-shift-title">
          <Input id="edit-shift-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Duration (hours)" htmlFor="edit-shift-duration">
            <Input id="edit-shift-duration" type="number" min={1} value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
          </FormField>
          <FormField label="Capacity" htmlFor="edit-shift-capacity">
            <Input id="edit-shift-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
