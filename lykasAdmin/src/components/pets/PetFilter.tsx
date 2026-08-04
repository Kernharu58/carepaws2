import { Select } from "../ui/FormUI";

interface PetFilterProps {
  species: string;
  status: string;
  onSpeciesChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

/** Species/status filter bar shared by the pet list and gallery views. */
export default function PetFilter({ species, status, onSpeciesChange, onStatusChange }: PetFilterProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select value={species} onChange={(e) => onSpeciesChange(e.target.value)} aria-label="Filter by species" className="w-auto">
        <option value="All">Species: All</option>
        <option value="Dog">Dog</option>
        <option value="Cat">Cat</option>
        <option value="Other">Other</option>
      </Select>
      <Select value={status} onChange={(e) => onStatusChange(e.target.value)} aria-label="Filter by status" className="w-auto">
        <option value="All">Status: All</option>
        <option value="Available">Available</option>
        <option value="Pending">Pending</option>
        <option value="Adopted">Adopted</option>
        <option value="Foster">Foster</option>
      </Select>
    </div>
  );
}
