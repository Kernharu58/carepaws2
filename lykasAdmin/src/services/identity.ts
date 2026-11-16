import { api } from "./api";
import type { IdentityDetail, ReviewPayload } from "../types/identity";

// Every call goes through the backend verification service. The admin app never
// writes an identity status itself and never receives a public file URL.

export async function fetchIdentityDetail(documentId: string): Promise<IdentityDetail> {
  const res = await api.get(`/api/identity/documents/${documentId}`);
  return res.data.data as IdentityDetail;
}

/** Fetches the ID image with the reviewer's credentials (never via a public link). */
export async function fetchIdentityFile(documentId: string): Promise<Blob> {
  const res = await api.get(`/api/identity/documents/${documentId}/file`, { responseType: "blob" });
  return res.data as Blob;
}

export async function submitIdentityReview(documentId: string, payload: ReviewPayload) {
  const res = await api.post(`/api/identity/documents/${documentId}/review`, payload);
  return res.data;
}
