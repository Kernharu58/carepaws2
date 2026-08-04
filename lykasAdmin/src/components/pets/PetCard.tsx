import { PawPrint } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import type { Pet } from "../../hooks/usePets";

export default function PetCard({ pet, onClick }: { pet: Pet; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-in flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex h-40 items-center justify-center bg-gray-100">
        {pet.imageUrl ? (
          <img src={pet.imageUrl} alt={pet.name} className="h-full w-full object-cover" />
        ) : (
          <PawPrint className="h-10 w-10 text-gray-300" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900">{pet.name}</p>
          <StatusBadge status={pet.status} />
        </div>
        <p className="text-sm text-gray-500">
          {pet.species}
          {pet.breed ? ` · ${pet.breed}` : ""}
        </p>
      </div>
    </button>
  );
}
