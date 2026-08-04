import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, PawPrint } from "lucide-react";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader, Card } from "../components/ui/SharedUI";
import { LoadingState, ErrorState } from "../components/ui/StateDisplays";
import StatusBadge from "../components/ui/StatusBadge";
import type { Pet } from "../hooks/usePets";

/**
 * Read-focused single-pet profile — the destination for "view details"
 * links from the catalog/gallery. For editing, staff use PetManagement's
 * master-detail screen instead; this page is the quick-look view.
 */
export default function PetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get(`/api/pets/${id}`)
      .then((res) => {
        if (!cancelled) setPet(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Failed to load pet"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !pet) return <ErrorState message={error ?? "Pet not found"} />;

  return (
    <div>
      <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <PageHeader
        title={pet.name}
        description={`${pet.species}${pet.breed ? ` · ${pet.breed}` : ""}`}
        actions={<StatusBadge status={pet.status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="flex h-56 items-center justify-center overflow-hidden p-0">
          {pet.imageUrl ? (
            <img src={pet.imageUrl} alt={pet.name} className="h-full w-full object-cover" />
          ) : (
            <PawPrint className="h-12 w-12 text-gray-300" aria-hidden="true" />
          )}
        </Card>

        <Card>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Gender</dt>
              <dd className="font-medium text-gray-900">{pet.gender ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Size</dt>
              <dd className="font-medium text-gray-900">{pet.size ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Age</dt>
              <dd className="font-medium text-gray-900">{pet.age ? `${pet.age} yrs` : "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Energy level</dt>
              <dd className="font-medium text-gray-900">{pet.energyLevel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Temperament</dt>
              <dd className="font-medium text-gray-900">{pet.temperament ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Health status</dt>
              <dd className="font-medium text-gray-900">{pet.healthStatus || "—"}</dd>
            </div>
          </dl>
          {pet.description && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <dt className="mb-1 text-sm text-gray-500">Description</dt>
              <dd className="text-sm text-gray-700">{pet.description}</dd>
            </div>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate(`/pets/management?petId=${pet._id}`)}
              className="text-sm text-primary hover:underline"
            >
              Manage this pet's full profile →
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
