import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../services/api";
import { FormField, Input, Select } from "../ui/FormUI";
import TextArea from "../ui/TextArea";
import Button from "../ui/Button";
import Alert from "../ui/Alert";

export interface AdoptionFormValues {
  pet: string;
  applicant: string;
  phone: string;
  address: string;
  experience: string;
  householdSize: string;
  isRenting: boolean;
  landlordApproval: boolean;
  type: "adoption" | "foster";
  fosterPeriod: string;
}

const EMPTY_VALUES: AdoptionFormValues = {
  pet: "",
  applicant: "",
  phone: "",
  address: "",
  experience: "",
  householdSize: "",
  isRenting: false,
  landlordApproval: false,
  type: "adoption",
  fosterPeriod: "",
};

interface PetOption {
  _id: string;
  name: string;
  species: string;
  status: string;
}

interface ApplicantOption {
  _id: string;
  displayName: string;
  email: string;
}

interface AdoptionFormProps {
  initialValues?: Partial<AdoptionFormValues>;
  onSubmit: (values: AdoptionFormValues) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
  submitLabel?: string;
}

/**
 * The reusable adoption/foster application form — shared by the
 * AdoptionForm page (staff creating an application on an applicant's
 * behalf) and reusable anywhere else an application needs to be
 * captured. Separate from pages/AdoptionForm.tsx, which composes this
 * component with routing/submission concerns (§12.4).
 */
export default function AdoptionForm({ initialValues, onSubmit, submitting, submitError, submitLabel = "Submit application" }: AdoptionFormProps) {
  const [values, setValues] = useState<AdoptionFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [pets, setPets] = useState<PetOption[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [applicants, setApplicants] = useState<ApplicantOption[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/pets", { params: { status: "Available", limit: 100 } })
      .then((res) => {
        if (!cancelled) setPets(res.data.data);
      })
      .finally(() => {
        if (!cancelled) setPetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/auth/users", { params: { role: "user", limit: 100, sortBy: "displayName", sortOrder: "asc" } })
      .then((res) => {
        if (!cancelled) setApplicants(res.data.data);
      })
      .finally(() => {
        if (!cancelled) setApplicantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof AdoptionFormValues>(key: K, value: AdoptionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit}>
      {submitError && (
        <div className="mb-4">
          <Alert tone="danger">{submitError}</Alert>
        </div>
      )}

      <FormField label="Applicant" htmlFor="af-applicant">
        <Select
          id="af-applicant"
          required
          value={values.applicant}
          onChange={(e) => set("applicant", e.target.value)}
          disabled={applicantsLoading}
        >
          <option value="">{applicantsLoading ? "Loading applicants…" : "Select the applicant"}</option>
          {applicants.map((user) => (
            <option key={user._id} value={user._id}>
              {user.displayName} ({user.email})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Pet" htmlFor="af-pet">
        <Select id="af-pet" required value={values.pet} onChange={(e) => set("pet", e.target.value)} disabled={petsLoading}>
          <option value="">{petsLoading ? "Loading available pets…" : "Select a pet"}</option>
          {pets.map((pet) => (
            <option key={pet._id} value={pet._id}>
              {pet.name} ({pet.species})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Application type" htmlFor="af-type">
        <Select id="af-type" value={values.type} onChange={(e) => set("type", e.target.value as "adoption" | "foster")}>
          <option value="adoption">Adoption</option>
          <option value="foster">Foster</option>
        </Select>
      </FormField>

      {values.type === "foster" && (
        <FormField label="Foster period" htmlFor="af-foster-period">
          <Input
            id="af-foster-period"
            placeholder="e.g. 4 weeks"
            value={values.fosterPeriod}
            onChange={(e) => set("fosterPeriod", e.target.value)}
          />
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Phone" htmlFor="af-phone">
          <Input id="af-phone" required value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </FormField>
        <FormField label="Household size" htmlFor="af-household">
          <Input
            id="af-household"
            type="number"
            min={1}
            value={values.householdSize}
            onChange={(e) => set("householdSize", e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Address" htmlFor="af-address">
        <Input id="af-address" required value={values.address} onChange={(e) => set("address", e.target.value)} />
      </FormField>

      <FormField label="Pet ownership / handling experience" htmlFor="af-experience">
        <TextArea id="af-experience" rows={3} value={values.experience} onChange={(e) => set("experience", e.target.value)} />
      </FormField>

      <div className="mb-4 space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={values.isRenting} onChange={(e) => set("isRenting", e.target.checked)} className="rounded border-gray-300" />
          Applicant is renting their home
        </label>
        {values.isRenting && (
          <label className="ml-6 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={values.landlordApproval}
              onChange={(e) => set("landlordApproval", e.target.checked)}
              className="rounded border-gray-300"
            />
            Landlord has approved pet ownership
          </label>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
