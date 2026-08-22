import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Syringe, Stethoscope, BookHeart } from "lucide-react";
import { api, getApiErrorMessage } from "../services/api";
import { usePets } from "../hooks/usePets";
import { PageHeader, Card } from "../components/ui/SharedUI";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/StateDisplays";
import { Input } from "../components/ui/FormUI";

interface MedicalSummary {
  vaccinations: { _id: string; vaccineName: string; dateGiven: string; nextDueDate?: string }[];
  vetVisits: { _id: string; visitDate: string; reason: string }[];
  records: { _id: string; type: string; date: string; description: string }[];
}

export default function Health() {
  const pets = usePets();
  const [searchParams, setSearchParams] = useSearchParams();
  const petId = searchParams.get("petId");

  const [summary, setSummary] = useState<MedicalSummary | null>(null);
  const [babyBook, setBabyBook] = useState<{ _id: string; title: string; content?: string; date: string; category: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!petId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.get(`/api/medical/summary/${petId}`), api.get(`/api/baby-book/${petId}`)])
      .then(([medicalRes, babyBookRes]) => {
        if (cancelled) return;
        setSummary(medicalRes.data.data);
        setBabyBook(babyBookRes.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Failed to load health records"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [petId]);

  return (
    <div>
      <PageHeader title="Health & Baby Book" description="Medical timeline and photo/growth journal per pet." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="p-0">
          <div className="border-b border-gray-100 p-3">
            <Input value={pets.search} onChange={(e) => pets.onSearchChange(e.target.value)} placeholder="Search pets…" />
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {pets.rows.map((pet) => (
              <button
                key={pet._id}
                type="button"
                onClick={() => setSearchParams({ petId: pet._id })}
                className={`block w-full border-b border-gray-50 px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${petId === pet._id ? "bg-emerald-50 font-medium" : "text-gray-700"}`}
              >
                {pet.name} <span className="text-xs text-gray-400">({pet.species})</span>
              </button>
            ))}
          </div>
        </Card>

        <div>
          {!petId ? (
            <Card>
              <p className="py-12 text-center text-sm text-gray-500">Select a pet to view its health timeline.</p>
            </Card>
          ) : loading ? (
            <Card>
              <LoadingState />
            </Card>
          ) : error ? (
            <Card>
              <ErrorState message={error} />
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-gray-700">Vaccinations</h3>
                </div>
                {!summary?.vaccinations.length ? (
                  <EmptyState title="No vaccination records" />
                ) : (
                  summary.vaccinations.map((v) => (
                    <p key={v._id} className="py-1 text-sm text-gray-600">
                      {v.vaccineName} — given {new Date(v.dateGiven).toLocaleDateString()}
                      {v.nextDueDate && `, next due ${new Date(v.nextDueDate).toLocaleDateString()}`}
                    </p>
                  ))
                )}
              </Card>

              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-gray-700">Vet visits</h3>
                </div>
                {!summary?.vetVisits.length ? (
                  <EmptyState title="No vet visits recorded" />
                ) : (
                  summary.vetVisits.map((v) => (
                    <p key={v._id} className="py-1 text-sm text-gray-600">
                      {new Date(v.visitDate).toLocaleDateString()} — {v.reason}
                    </p>
                  ))
                )}
              </Card>

              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <BookHeart className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-gray-700">Baby book</h3>
                </div>
                {babyBook.length === 0 ? (
                  <EmptyState title="No baby book entries yet" />
                ) : (
                  babyBook.map((entry) => (
                    <div key={entry._id} className="py-1.5">
                      <p className="text-sm text-gray-600">
                        {new Date(entry.date).toLocaleDateString()} — {entry.title}{" "}
                        <span className="text-xs text-gray-400">({entry.category})</span>
                      </p>
                      {entry.content && <p className="text-xs text-gray-400">{entry.content}</p>}
                    </div>
                  ))
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
