import { useNavigate } from "react-router-dom";
import { usePets } from "../hooks/usePets";
import { PageHeader } from "../components/ui/SharedUI";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/StateDisplays";
import PetCard from "../components/pets/PetCard";
import PetFilter from "../components/pets/PetFilter";

export default function PetGallery() {
  const pets = usePets();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader title="Pet Gallery" description="Browse the catalog visually." />

      <div className="mb-4">
        <PetFilter
          species={pets.filters.species ?? "All"}
          status={pets.filters.status ?? "All"}
          onSpeciesChange={(v) => pets.onFilterChange("species", v)}
          onStatusChange={(v) => pets.onFilterChange("status", v)}
        />
      </div>

      {pets.loading ? (
        <LoadingState />
      ) : pets.error ? (
        <ErrorState message={pets.error} onRetry={pets.reload} />
      ) : pets.rows.length === 0 ? (
        <EmptyState title="No pets match these filters" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {pets.rows.map((pet) => (
            <PetCard key={pet._id} pet={pet} onClick={() => navigate(`/pets/management?petId=${pet._id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
