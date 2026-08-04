import { useState, type FormEvent } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { FormField, Input } from "../ui/FormUI";

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: { title: string; date: string; durationHours: number; capacity: number }) => Promise<void>;
  submitting: boolean;
}

export default function AddShiftModal({ isOpen, onClose, onSubmit, submitting }: AddShiftModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [durationHours, setDurationHours] = useState("2");
  const [capacity, setCapacity] = useState("1");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ title, date, durationHours: Number(durationHours), capacity: Number(capacity) });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a shift"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="add-shift-form" loading={submitting}>
            Add shift
          </Button>
        </>
      }
    >
      <form id="add-shift-form" onSubmit={handleSubmit}>
        <FormField label="Title" htmlFor="shift-title">
          <Input id="shift-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Date & time" htmlFor="shift-date">
          <Input id="shift-date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Duration (hours)" htmlFor="shift-duration">
            <Input id="shift-duration" type="number" min={1} value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
          </FormField>
          <FormField label="Capacity" htmlFor="shift-capacity">
            <Input id="shift-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
