import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card } from "../components/ui/SharedUI";
import AdoptionFormComponent, { type AdoptionFormValues } from "../components/adoption/AdoptionForm";
import { api, getApiErrorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";

/**
 * The create/edit adoption-application page — lets staff record an
 * application on an applicant's behalf (e.g. a walk-in adopter without
 * the mobile app). Composes components/adoption/AdoptionForm.tsx.
 */
export default function AdoptionForm() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: AdoptionFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/applications", {
        ...values,
        householdSize: values.householdSize ? Number(values.householdSize) : undefined,
      });
      showToast("Application recorded", "success");
      navigate("/adoptions");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit application"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/adoptions")}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to applications
      </button>

      <PageHeader title="New Adoption Application" description="Record an application on behalf of an applicant." />

      <Card className="max-w-2xl">
        <AdoptionFormComponent onSubmit={handleSubmit} submitting={submitting} submitError={error} submitLabel="Submit application" />
      </Card>
    </div>
  );
}
