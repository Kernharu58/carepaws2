import { useCallback, useState } from "react";
import { api, getApiErrorMessage } from "../services/api";
import { useResourceList } from "./useResourceList";
import type { Pet } from "./usePets";

export type ApplicationStage =
  | "submitted"
  | "document_review"
  | "interview"
  | "home_visit"
  | "risk_assessment"
  | "approved"
  | "adoption_scheduled"
  | "completed"
  | "rejected";

export interface Application {
  _id: string;
  pet: Pet;
  applicant: { _id: string; displayName: string; email: string };
  phone: string;
  address: string;
  type: "adoption" | "foster";
  status: "pending" | "approved" | "rejected";
  stage: ApplicationStage;
  createdAt: string;
}

/**
 * Application list + status/stage transitions, built on the shared list
 * hook. Backs both the Adoptions page and the Adoption Scheduling /
 * pipeline-tracker views.
 */
export function useApplications() {
  const list = useResourceList<Application>("/api/applications");
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const updateStatus = useCallback(
    async (id: string, status: "approved" | "rejected", note?: string) => {
      setMutating(true);
      setMutationError(null);
      try {
        await api.put(`/api/applications/${id}/status`, { status, note });
        list.reload();
        return true;
      } catch (err) {
        setMutationError(getApiErrorMessage(err, "Failed to update application status"));
        return false;
      } finally {
        setMutating(false);
      }
    },
    [list]
  );

  const updateStage = useCallback(
    async (id: string, stage: ApplicationStage, note?: string) => {
      setMutating(true);
      setMutationError(null);
      try {
        await api.put(`/api/applications/${id}/stage`, { stage, note });
        list.reload();
        return true;
      } catch (err) {
        setMutationError(getApiErrorMessage(err, "Failed to update application stage"));
        return false;
      } finally {
        setMutating(false);
      }
    },
    [list]
  );

  return { ...list, updateStatus, updateStage, mutating, mutationError };
}
