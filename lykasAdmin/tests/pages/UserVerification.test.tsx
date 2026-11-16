import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import UserVerification from "../../src/pages/UserVerification";
import ProtectedRoute from "../../src/components/layout/ProtectedRoute";
import { AuthProvider } from "../../src/context/AuthContext";
import { ToastProvider } from "../../src/context/ToastContext";
import { tokenStore } from "../../src/services/api";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } };
});
import { api } from "../../src/services/api";

const DAY = 24 * 60 * 60 * 1000;
const CHECKLIST = [
  { key: "imageReadable", label: "Image is clear and readable", naAllowed: false },
  { key: "documentComplete", label: "Whole document is visible (no cropped edges)", naAllowed: false },
  { key: "acceptableIdType", label: "Acceptable government-issued ID type", naAllowed: false },
  { key: "nameMatchesApplicant", label: "Name matches the applicant's account", naAllowed: false },
  { key: "photoConsistent", label: "Photo is consistent with the applicant, where appropriate", naAllowed: true },
  { key: "notExpired", label: "Document is not expired", naAllowed: true },
  { key: "noVisibleAlterations", label: "No visible alterations or inconsistencies", naAllowed: false },
];

function row(overrides: Record<string, unknown> = {}) {
  return {
    _id: "d1",
    user: { _id: "u1", displayName: "Maria Santos", email: "maria@example.com", phone: "0917000111", address: "12 Rizal St", emailVerified: true },
    idType: "passport",
    status: "pending",
    expiresAt: new Date(Date.now() + 400 * DAY).toISOString(),
    isExpired: false,
    isRenewal: false,
    submissionChannel: "self",
    hasFile: true,
    createdAt: new Date(Date.now() - 2 * DAY).toISOString(),
    ...overrides,
  };
}

function detail(docOverrides: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    document: { ...row(), fileType: "image/jpeg", viewedByYou: false, canReview: true, ...docOverrides },
    history: [
      { _id: "h1", action: "submitted", fromStatus: "unverified", toStatus: "pending", reason: null, actor: { displayName: "Maria Santos", role: "user" }, actorRole: "user", createdAt: "2026-11-10T08:00:00.000Z" },
      { _id: "h0", action: "rejected", fromStatus: "pending", toStatus: "rejected", reason: "Photo was blurry", actor: { displayName: "Admin Ana", role: "admin" }, actorRole: "admin", createdAt: "2026-11-01T08:00:00.000Z" },
    ],
    warnings: [],
    checklist: CHECKLIST,
    disclaimer: "Staff visual assessment of the submitted image only. It is not forensic authentication and does not confirm the ID against any government database.",
    minReasonLength: 5,
    ...extra,
  };
}

function mockApi(rows: unknown[], det: ReturnType<typeof detail> = detail()) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/api/identity/queue") return Promise.resolve({ data: { data: rows, pagination: { total: rows.length, page: 1, limit: 20, pages: 1 } } });
    if (url.endsWith("/file")) return Promise.resolve({ data: new Blob(["img"], { type: "image/jpeg" }) });
    if (url.startsWith("/api/identity/documents/")) return Promise.resolve({ data: { data: det } });
    return Promise.resolve({ data: { data: [] } });
  });
}

function renderPage() {
  return render(
    <ToastProvider>
      <UserVerification />
    </ToastProvider>
  );
}

async function openReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Review ID" }));
  return screen.findByRole("dialog");
}

async function passEverything(user: ReturnType<typeof userEvent.setup>) {
  for (const item of CHECKLIST) await user.selectOptions(screen.getByLabelText(item.label), "pass");
}

describe("UserVerification (identity queue + review)", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.put).mockReset();
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows the pending verification queue from the identity endpoint, with expiry and channel indicators", async () => {
    mockApi([row(), row({ _id: "d2", user: { _id: "u2", displayName: "Jun Reyes", email: "jun@example.com" }, idType: "drivers_license", isExpired: true, expiresAt: new Date(Date.now() - DAY).toISOString(), isRenewal: true, submissionChannel: "staff_assisted" })]);
    renderPage();
    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
    expect(screen.getByText("Passport")).toBeInTheDocument();
    expect(screen.getByText("Driver's license")).toBeInTheDocument();
    expect(screen.getByText(/\(expired\)/)).toBeInTheDocument();
    expect(screen.getByText("renewal")).toBeInTheDocument();
    expect(screen.getByText("walk-in")).toBeInTheDocument();
    // the queue is read from the identity endpoint, never the old direct-status endpoint
    expect(vi.mocked(api.get).mock.calls.some(([u]) => u === "/api/identity/queue")).toBe(true);
    expect(vi.mocked(api.get).mock.calls.some(([u]) => String(u).includes("/api/auth/users/verification-queue"))).toBe(false);
  });

  it("explains that review is a staff assessment, not authentication", async () => {
    mockApi([]);
    renderPage();
    expect(await screen.findByText(/not a check against any government database/i)).toBeInTheDocument();
    expect(await screen.findByText("No identity documents in this view")).toBeInTheDocument();
  });

  it("previews the ID image through an authenticated blob request (no public URL), and shows applicant info, history, reviewer and timestamps", async () => {
    mockApi([row()]);
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);

    expect(await within(dialog).findByAltText("Government ID preview")).toHaveAttribute("src", "blob:preview");
    const fileCall = vi.mocked(api.get).mock.calls.find(([u]) => String(u).endsWith("/file"));
    expect(fileCall?.[0]).toBe("/api/identity/documents/d1/file");
    expect(fileCall?.[1]).toMatchObject({ responseType: "blob" });

    expect(within(dialog).getByText("0917000111")).toBeInTheDocument();
    expect(within(dialog).getByText("12 Rizal St")).toBeInTheDocument();
    expect(within(dialog).getByText(/email verified/)).toBeInTheDocument();

    const history = within(dialog).getByRole("region", { name: "Verification history" });
    expect(within(history).getByText("ID rejected")).toBeInTheDocument();
    expect(within(history).getByText(/Admin Ana \(admin\)/)).toBeInTheDocument();
    expect(within(history).getByText(/Reason: Photo was blurry/)).toBeInTheDocument();
    expect(within(dialog).getByText(/not forensic authentication/i)).toBeInTheDocument();
  });

  it("clearly marks an expired document in the review dialog", async () => {
    mockApi([row({ isExpired: true })], detail({ isExpired: true, expiresAt: new Date(Date.now() - DAY).toISOString() }));
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);
    expect(await within(dialog).findByText(/— EXPIRED/)).toBeInTheDocument();
  });

  it("keeps Approve disabled until every checklist item passes, then sends the decision to the backend", async () => {
    mockApi([row()]);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);
    await within(dialog).findByAltText("Government ID preview");

    const approve = within(dialog).getByRole("button", { name: "Approve identity" });
    expect(approve).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(CHECKLIST[0].label), "pass");
    expect(approve).toBeDisabled();
    await passEverything(user);
    expect(approve).toBeEnabled();

    await user.click(approve);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe("/api/identity/documents/d1/review");
    expect(body.decision).toBe("approve");
    expect(body.checklist).toMatchObject({ imageReadable: "pass", nameMatchesApplicant: "pass", noVisibleAlterations: "pass" });
    // never writes a status directly
    expect(api.put).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("will not reject without a reason (no request is sent)", async () => {
    mockApi([row()]);
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);
    await within(dialog).findByAltText("Government ID preview");

    await user.click(within(dialog).getByRole("button", { name: "Reject identity" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/reason of at least 5 characters/i);
    expect(api.post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/Reason/), "abc");
    await user.click(within(dialog).getByRole("button", { name: "Reject identity" }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it("rejects with a reason", async () => {
    mockApi([row()]);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);
    await within(dialog).findByAltText("Government ID preview");

    await user.type(within(dialog).getByLabelText(/Reason/), "Name does not match the account");
    await user.click(within(dialog).getByRole("button", { name: "Reject identity" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ decision: "reject", reason: "Name does not match the account" });
  });

  it("requests resubmission with a mandatory reason", async () => {
    mockApi([row()]);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);
    await within(dialog).findByAltText("Government ID preview");

    await user.click(within(dialog).getByRole("button", { name: "Request resubmission" }));
    expect(api.post).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/Reason/), "Please retake the photo in good light");
    await user.click(within(dialog).getByRole("button", { name: "Request resubmission" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ decision: "request_resubmission", reason: "Please retake the photo in good light" });
  });

  it("shows the server's explanation when the backend refuses a decision, and keeps what the reviewer typed", async () => {
    mockApi([row()]);
    vi.mocked(api.post).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { success: false, code: "ALREADY_REVIEWED", message: "Another reviewer has just decided on this document." } } });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);
    await within(dialog).findByAltText("Government ID preview");

    await user.type(within(dialog).getByLabelText(/Reason/), "Looks altered near the date");
    await user.click(within(dialog).getByRole("button", { name: "Reject identity" }));
    expect(await within(dialog).findByText(/Another reviewer has just decided/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Reason/)).toHaveValue("Looks altered near the date");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not offer decisions to a reviewer who is not allowed to decide on that document (e.g. their own ID)", async () => {
    mockApi([row()], detail({ canReview: false }));
    const user = userEvent.setup();
    renderPage();
    const dialog = await openReview(user);
    expect(await within(dialog).findByText(/You cannot decide on this document/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve identity" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Reject identity" })).toBeDisabled();
    expect(within(dialog).queryByLabelText(CHECKLIST[0].label)).not.toBeInTheDocument();
  });

  it("an already-verified record is read-only except for revocation, which needs a reason", async () => {
    mockApi([row({ status: "verified" })], detail({ status: "verified" }));
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "View ID record" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByAltText("Government ID preview");
    expect(within(dialog).queryByRole("button", { name: "Approve identity" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Revoke: reject ID" }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it("surfaces an authorization failure from the queue (backend refuses non-reviewers) without showing any rows", async () => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status: 403, data: { success: false, message: "Insufficient role" } } });
    renderPage();
    expect(await screen.findByText(/Insufficient role/)).toBeInTheDocument();
    expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
  });
});

describe("Identity Verification route protection", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.mocked(api.get).mockReset();
  });

  function renderRoute() {
    return render(
      <MemoryRouter initialEntries={["/verification"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route path="/verification" element={<ProtectedRoute roles={["admin", "super_admin"]}><div>Identity page</div></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  }

  it("shows 'Not authorized' to ordinary staff (the UI mirrors the backend; the backend is still the real gate)", async () => {
    tokenStore.setTokens("a", "r");
    vi.mocked(api.get).mockResolvedValue({ data: { data: { user: { id: "1", displayName: "Staff Sam", email: "s@example.com", role: "staff", status: "active" } } } });
    renderRoute();
    await waitFor(() => expect(screen.getByText("Not authorized")).toBeInTheDocument());
    expect(screen.queryByText("Identity page")).not.toBeInTheDocument();
  });

  it("admins can open it", async () => {
    tokenStore.setTokens("a", "r");
    vi.mocked(api.get).mockResolvedValue({ data: { data: { user: { id: "1", displayName: "Admin Ana", email: "a@example.com", role: "admin", status: "active" } } } });
    renderRoute();
    await waitFor(() => expect(screen.getByText("Identity page")).toBeInTheDocument());
  });
});
