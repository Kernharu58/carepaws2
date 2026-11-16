import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import axios from "axios";
import DocumentsScreen from "../app/documents";
import ProfileScreen from "../app/(tabs)/profile";
import { describeIdentity, parseExpiryInput, classifyUploadError, ensureIdentityBeforeApplying } from "../utils/identity";
import { getNotificationRoute } from "../utils/notifications";

const mockPush = jest.fn();
const mockRefreshUser = jest.fn(() => Promise.resolve());
let mockUser: Record<string, unknown> = { id: "u1", role: "user", displayName: "Kern", email: "k@example.com", emailVerified: true, identityVerificationStatus: "unverified" };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() },
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: jest.fn(), refreshUser: mockRefreshUser }),
}));
// One stable object: the screen lists it as a hook dependency, so a new object per render would reload forever.
const mockFlag = { mark: jest.fn(), take: () => false };
jest.mock("../context/RealtimeContext", () => ({
  useRealtimeReload: jest.fn(),
  useSilentFlag: () => mockFlag,
}));
jest.mock("react-native-safe-area-context", () => {
  const { View: MockView } = jest.requireActual("react-native");
  return { SafeAreaView: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView> };
});
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("../utils/api", () => {
  const actual = jest.requireActual("../utils/api");
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } };
});

import * as DocumentPicker from "expo-document-picker";
import { api } from "../utils/api";

const ID_TYPES = [
  { value: "passport", label: "Passport", expiryRequired: true },
  { value: "drivers_license", label: "Driver's license", expiryRequired: true },
  { value: "national_id", label: "National ID", expiryRequired: false },
];
const DAY = 86400000;

function overview(over: Record<string, unknown> = {}) {
  return {
    status: "unverified",
    emailVerified: true,
    reason: null,
    expiresAt: null,
    daysUntilExpiry: null,
    expiringSoon: false,
    document: null,
    pendingDocument: null,
    canUpload: true,
    canWithdraw: false,
    isRenewal: false,
    idTypes: ID_TYPES,
    policy: { adoption: "before_submission", foster: "before_submission" },
    history: [],
    ...over,
  };
}

function mockServer(ov: Record<string, unknown>, docs: unknown[] = []) {
  jest.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/api/identity/me") return Promise.resolve({ data: { data: overview(ov) } });
    if (url === "/api/documents/my") return Promise.resolve({ data: { data: docs } });
    return Promise.resolve({ data: { data: [] } });
  });
}

const FUTURE = new Date(Date.now() + 800 * DAY).toISOString().slice(0, 10);

async function openUploadForm() {
  fireEvent.press(await screen.findByTestId("identity-upload-button"));
  return screen.findByTestId("identity-form");
}
function pickFile(name = "passport.jpg") {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/passport.jpg", name, mimeType: "image/jpeg" }] } as never);
  fireEvent.press(screen.getByTestId("identity-choose-file"));
}

beforeEach(() => {
  jest.mocked(api.get).mockReset();
  jest.mocked(api.post).mockReset();
  jest.mocked(api.delete).mockReset();
  jest.mocked(DocumentPicker.getDocumentAsync).mockReset();
  mockPush.mockReset();
  mockRefreshUser.mockClear();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("Identity card: status display", () => {
  it("unverified: explains why identity is required and offers upload; email is described as separate", async () => {
    mockServer({ status: "unverified" });
    render(<DocumentsScreen />);
    expect(await screen.findByText("Identity not verified")).toBeTruthy();
    expect(screen.getByTestId("identity-why").props.children).toMatch(/valid government-issued photo ID/);
    expect(screen.getByTestId("identity-why").props.children).toMatch(/separate from verifying your email/);
    expect(screen.getByText("Upload government ID")).toBeTruthy();
  });

  it("pending: shows waiting-for-review, no upload button, a withdraw option", async () => {
    mockServer({ status: "pending", canUpload: false, canWithdraw: true, pendingDocument: { _id: "d1", status: "pending", idType: "passport", createdAt: new Date().toISOString() } });
    render(<DocumentsScreen />);
    expect(await screen.findByText("Waiting for staff review")).toBeTruthy();
    expect(screen.queryByTestId("identity-upload-button")).toBeNull();
    expect(screen.getByTestId("identity-withdraw-button")).toBeTruthy();
  });

  it("verified: shows the verified state with its expiry and no upload action", async () => {
    mockServer({ status: "verified", canUpload: false, expiresAt: new Date(Date.now() + 700 * DAY).toISOString(), daysUntilExpiry: 700 });
    render(<DocumentsScreen />);
    expect(await screen.findByText("Identity verified")).toBeTruthy();
    expect(screen.getByTestId("identity-body").props.children).toMatch(/valid until/);
    expect(screen.queryByTestId("identity-upload-button")).toBeNull();
  });

  it("verified but expiring soon: invites a renewal and says the person stays verified meanwhile", async () => {
    mockServer({ status: "verified", canUpload: true, expiringSoon: true, isRenewal: true, daysUntilExpiry: 12, expiresAt: new Date(Date.now() + 12 * DAY).toISOString() });
    render(<DocumentsScreen />);
    expect(await screen.findByText("Upload renewed ID")).toBeTruthy();
    expect(screen.getByTestId("identity-body").props.children).toMatch(/expires in 12 days/);
    expect(screen.getByTestId("identity-body").props.children).toMatch(/stay verified/);
  });

  it("rejected: shows the staff's reason and lets the person upload a replacement", async () => {
    mockServer({ status: "rejected", reason: "The photo is blurry" });
    render(<DocumentsScreen />);
    expect(await screen.findByText("ID was not accepted")).toBeTruthy();
    expect(screen.getByTestId("identity-body").props.children).toContain("Reason: The photo is blurry");
    expect(screen.getByText("Upload a new ID")).toBeTruthy();
  });

  it("resubmission required: shows the reason and the replacement action", async () => {
    mockServer({ status: "resubmission_required", reason: "Edges are cropped" });
    render(<DocumentsScreen />);
    expect(await screen.findByText("Please upload your ID again")).toBeTruthy();
    expect(screen.getByTestId("identity-body").props.children).toContain("Reason: Edges are cropped");
    expect(screen.getByText("Upload a new ID")).toBeTruthy();
  });

  it("expired: says so, and allows replacing it", async () => {
    mockServer({ status: "expired", expiresAt: new Date(Date.now() - 3 * DAY).toISOString() });
    render(<DocumentsScreen />);
    expect(await screen.findByText("Your ID has expired")).toBeTruthy();
    expect(screen.getByText("Upload a current ID")).toBeTruthy();
  });

  it("keeps government IDs out of the application-documents list (separate verification kinds)", async () => {
    mockServer({ status: "unverified" }, [
      { _id: "x1", type: "government_id", status: "verified", createdAt: "2026-01-01" },
      { _id: "x2", type: "proof_of_address", status: "pending", createdAt: "2026-01-01" },
    ]);
    render(<DocumentsScreen />);
    expect(await screen.findByText("Application documents")).toBeTruthy();
    expect(screen.getAllByText("Proof of address").length).toBeGreaterThan(0);
    expect(screen.queryByText("Government ID")).toBeNull();
  });
});

describe("Identity upload flow", () => {
  it("uploads the ID with the chosen type and expiry, shows progress, then shows a confirmation and refreshes the account", async () => {
    mockServer({ status: "unverified" });
    let resolveUpload: (v: unknown) => void = () => {};
    jest.mocked(api.post).mockImplementation((_url, _body, config) => {
      (config as { onUploadProgress?: (e: unknown) => void }).onUploadProgress?.({ loaded: 50, total: 100 });
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });
    render(<DocumentsScreen />);
    await openUploadForm();
    fireEvent.press(screen.getByTestId("id-type-passport"));
    fireEvent.changeText(screen.getByTestId("identity-expiry-input"), FUTURE);
    pickFile();
    await screen.findByText("passport.jpg");

    fireEvent.press(screen.getByTestId("identity-submit"));
    expect(await screen.findByText(/Uploading… 50%/)).toBeTruthy();

    // After the server accepts it, the next /me read shows the pending state.
    mockServer({ status: "pending", canUpload: false, canWithdraw: true, pendingDocument: { _id: "d1", status: "pending", idType: "passport", createdAt: new Date().toISOString() } });
    await act(async () => resolveUpload({ data: { success: true } }));

    expect(await screen.findByTestId("identity-notice")).toBeTruthy();
    expect(await screen.findByText("Waiting for staff review")).toBeTruthy();
    expect(screen.queryByTestId("identity-form")).toBeNull();
    expect(mockRefreshUser).toHaveBeenCalled();

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = jest.mocked(api.post).mock.calls[0] as [string, FormData, { timeout: number }];
    expect(url).toBe("/api/identity/documents");
    expect(config.timeout).toBeGreaterThanOrEqual(60000);
    // Works for both React Native's FormData (_parts) and a standards FormData (get).
    const anyBody = body as unknown as { get?: (k: string) => unknown; _parts?: [string, unknown][] };
    const field = (k: string) => (typeof anyBody.get === "function" ? anyBody.get(k) : anyBody._parts?.find(([n]) => n === k)?.[1]);
    expect(field("idType")).toBe("passport");
    expect(field("expiresAt")).toBe(FUTURE);
    expect(field("file")).toBeTruthy();
    // the client never sends a status or a user id
    expect(field("identityVerificationStatus") ?? null).toBeNull();
    expect(field("user") ?? null).toBeNull();
  });

  it("validates before sending: missing file, missing required expiry, malformed or past expiry", async () => {
    mockServer({ status: "unverified" });
    render(<DocumentsScreen />);
    await openUploadForm();

    fireEvent.press(screen.getByTestId("identity-submit"));
    expect((await screen.findByTestId("identity-form-error")).props.children).toMatch(/Choose the ID type and a photo/);

    pickFile();
    await screen.findByText("passport.jpg");
    fireEvent.press(screen.getByTestId("identity-submit"));
    await waitFor(() => expect(screen.getByTestId("identity-form-error").props.children).toMatch(/has an expiry date/));

    fireEvent.changeText(screen.getByTestId("identity-expiry-input"), "31/12/2030");
    fireEvent.press(screen.getByTestId("identity-submit"));
    await waitFor(() => expect(screen.getByTestId("identity-form-error").props.children).toMatch(/YYYY-MM-DD/));

    fireEvent.changeText(screen.getByTestId("identity-expiry-input"), "2020-01-01");
    fireEvent.press(screen.getByTestId("identity-submit"));
    await waitFor(() => expect(screen.getByTestId("identity-form-error").props.children).toMatch(/already expired/));
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the upload is refused and keeps the form so the person can retry", async () => {
    mockServer({ status: "unverified" });
    jest.mocked(api.post).mockRejectedValue(Object.assign(new axios.AxiosError("bad"), { response: { status: 400, data: { code: "FILE_TYPE_MISMATCH", message: "The file is not a valid JPEG, PNG, WebP or PDF" } } }));
    render(<DocumentsScreen />);
    await openUploadForm();
    fireEvent.press(screen.getByTestId("id-type-national_id"));
    pickFile();
    await screen.findByText("passport.jpg");
    fireEvent.press(screen.getByTestId("identity-submit"));

    expect((await screen.findByTestId("identity-form-error")).props.children).toMatch(/not a valid JPEG/);
    expect(screen.getByTestId("identity-form")).toBeTruthy();
    expect(screen.queryByTestId("identity-progress")).toBeNull(); // progress cleared after failure
    expect(screen.getByTestId("identity-submit")).not.toBeDisabled?.();
  });

  it("network interruption: explains it, keeps the form, and does not claim success", async () => {
    mockServer({ status: "unverified" });
    jest.mocked(api.post).mockRejectedValue(new axios.AxiosError("Network Error", "ERR_NETWORK"));
    render(<DocumentsScreen />);
    await openUploadForm();
    fireEvent.press(screen.getByTestId("id-type-national_id"));
    pickFile();
    await screen.findByText("passport.jpg");
    fireEvent.press(screen.getByTestId("identity-submit"));

    expect((await screen.findByTestId("identity-form-error")).props.children).toMatch(/connection was interrupted/i);
    expect(screen.getByTestId("identity-form")).toBeTruthy();
    expect(screen.queryByTestId("identity-notice")).toBeNull();
  });

  it("network interruption after the server actually received the ID: recovers by showing the pending state", async () => {
    mockServer({ status: "unverified" });
    jest.mocked(api.post).mockImplementation(() => {
      // The response was lost on the way back, but the server did store the ID.
      mockServer({ status: "pending", canUpload: false, canWithdraw: true, pendingDocument: { _id: "d9", status: "pending", idType: "national_id", createdAt: new Date().toISOString() } });
      return Promise.reject(new axios.AxiosError("Network Error", "ERR_NETWORK"));
    });
    render(<DocumentsScreen />);
    await openUploadForm();
    fireEvent.press(screen.getByTestId("id-type-national_id"));
    pickFile();
    await screen.findByText("passport.jpg");
    fireEvent.press(screen.getByTestId("identity-submit"));

    expect(await screen.findByText("Waiting for staff review")).toBeTruthy();
    expect((await screen.findByTestId("identity-notice")).props.children).toMatch(/was received/);
    expect(screen.queryByTestId("identity-form")).toBeNull();
  });

  it("prevents duplicate submissions: a second tap while uploading sends nothing", async () => {
    mockServer({ status: "unverified" });
    jest.mocked(api.post).mockImplementation(() => new Promise(() => {})); // never resolves
    render(<DocumentsScreen />);
    await openUploadForm();
    fireEvent.press(screen.getByTestId("id-type-national_id"));
    pickFile();
    await screen.findByText("passport.jpg");

    fireEvent.press(screen.getByTestId("identity-submit"));
    fireEvent.press(screen.getByTestId("identity-submit"));
    fireEvent.press(screen.getByTestId("identity-submit"));
    expect(await screen.findByTestId("identity-progress")).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("when the server says an ID is already pending, shows the pending state instead of an error", async () => {
    mockServer({ status: "unverified" });
    jest.mocked(api.post).mockImplementation(() => {
      mockServer({ status: "pending", canUpload: false, canWithdraw: true, pendingDocument: { _id: "d1", status: "pending", idType: "passport", createdAt: new Date().toISOString() } });
      return Promise.reject(Object.assign(new axios.AxiosError("conflict"), { response: { status: 409, data: { code: "DUPLICATE_PENDING", message: "You already have an ID waiting for review." } } }));
    });
    render(<DocumentsScreen />);
    await openUploadForm();
    fireEvent.press(screen.getByTestId("id-type-national_id"));
    pickFile();
    await screen.findByText("passport.jpg");
    fireEvent.press(screen.getByTestId("identity-submit"));
    expect(await screen.findByText("Waiting for staff review")).toBeTruthy();
  });

  it("withdrawing a pending upload asks for confirmation, then calls the identity endpoint", async () => {
    mockServer({ status: "pending", canUpload: false, canWithdraw: true, pendingDocument: { _id: "d1", status: "pending", idType: "passport", createdAt: new Date().toISOString() } });
    jest.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    render(<DocumentsScreen />);
    fireEvent.press(await screen.findByTestId("identity-withdraw-button"));
    const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    expect(api.delete).not.toHaveBeenCalled();
    await act(async () => buttons.find((b) => b.text === "Withdraw")?.onPress?.());
    expect(api.delete).toHaveBeenCalledWith("/api/identity/documents/d1");
  });
});

describe("Access and exposure", () => {
  it("an unauthorized/failed document read shows an error state and no document content", async () => {
    jest.mocked(api.get).mockRejectedValue(Object.assign(new axios.AxiosError("forbidden"), { response: { status: 403, data: { message: "You are not authorised to view this document" } } }));
    render(<DocumentsScreen />);
    expect(await screen.findByText(/not authorised to view this document/)).toBeTruthy();
    expect(screen.queryByTestId("identity-card")).toBeNull();
  });

  it("the app only ever talks to identity endpoints on the authenticated API (no file URL is rendered or opened)", async () => {
    mockServer({ status: "pending", canUpload: false, document: { _id: "d1", status: "pending", idType: "passport", createdAt: new Date().toISOString(), hasFile: true } });
    render(<DocumentsScreen />);
    await screen.findByText("Waiting for staff review");
    const urls = jest.mocked(api.get).mock.calls.map(([u]) => String(u));
    expect(urls.every((u) => u.startsWith("/api/"))).toBe(true);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/https?:\/\//);
  });
});

describe("Profile + notifications + apply gate", () => {
  it("profile shows the current identity status and links to the Documents screen", () => {
    mockUser = { ...mockUser, identityVerificationStatus: "expired" };
    render(<ProfileScreen />);
    expect(screen.getByText("expired")).toBeTruthy();
    expect(screen.getByTestId("profile-identity-action").props.children).toBe("Action needed");
    fireEvent.press(screen.getByTestId("profile-identity-status"));
    expect(mockPush).toHaveBeenCalledWith("/documents");
  });

  it("profile shows 'Verify ID' for an unverified account and no prompt once verified", () => {
    mockUser = { ...mockUser, identityVerificationStatus: "unverified" };
    const { unmount } = render(<ProfileScreen />);
    expect(screen.getByTestId("profile-identity-action").props.children).toBe("Verify ID");
    unmount();
    mockUser = { ...mockUser, identityVerificationStatus: "verified" };
    render(<ProfileScreen />);
    expect(screen.queryByTestId("profile-identity-action")).toBeNull();
  });

  it("identity decision notifications open the Documents screen", () => {
    expect(getNotificationRoute({ type: "IDENTITY_VERIFIED", refModel: "UserDocument", refId: "d1" })).toBe("/documents");
    expect(getNotificationRoute({ type: "IDENTITY_REJECTED", refModel: "UserDocument", refId: "d1" })).toBe("/documents");
    expect(getNotificationRoute({ type: "IDENTITY_RESUBMISSION_REQUIRED", refModel: null, refId: null })).toBe("/documents");
  });

  it("before applying, an unverified applicant is sent to verification (not to a form that would fail)", async () => {
    mockServer({ status: "unverified" });
    expect(await ensureIdentityBeforeApplying("adoption")).toBe(false);
    const [title, , buttons] = jest.mocked(Alert.alert).mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    expect(title).toMatch(/Verify your identity/);
    buttons.find((b) => b.text === "Verify my ID")?.onPress?.();
    expect(mockPush).toHaveBeenCalledWith("/documents");
  });

  it("lets a verified applicant, or a shelter that only requires ID before review, straight through", async () => {
    mockServer({ status: "verified", canUpload: false });
    expect(await ensureIdentityBeforeApplying("foster")).toBe(true);
    mockServer({ status: "unverified", policy: { adoption: "before_review", foster: "before_submission" } });
    expect(await ensureIdentityBeforeApplying("adoption")).toBe(true);
    expect(await ensureIdentityBeforeApplying("foster")).toBe(false);
  });

  it("if the pre-check cannot be made (offline) the server decides on submit", async () => {
    jest.mocked(api.get).mockRejectedValue(new axios.AxiosError("Network Error", "ERR_NETWORK"));
    expect(await ensureIdentityBeforeApplying("adoption")).toBe(true);
  });
});

describe("pure helpers", () => {
  it("parseExpiryInput", () => {
    expect(parseExpiryInput("")).toEqual({ ok: true, value: null });
    expect(parseExpiryInput(FUTURE)).toEqual({ ok: true, value: FUTURE });
    expect(parseExpiryInput("2031-02-30")).toMatchObject({ ok: false });
    expect(parseExpiryInput("tomorrow")).toMatchObject({ ok: false });
    expect(parseExpiryInput("2019-05-05")).toMatchObject({ ok: false });
  });

  it("classifyUploadError maps server codes and connection failures", () => {
    const http = (status: number, code?: string) => Object.assign(new axios.AxiosError("x"), { response: { status, data: { code, message: "m" } } });
    expect(classifyUploadError(new axios.AxiosError("Network Error", "ERR_NETWORK")).kind).toBe("network");
    expect(classifyUploadError(http(409, "DUPLICATE_PENDING")).kind).toBe("duplicate_pending");
    expect(classifyUploadError(http(409, "ALREADY_VERIFIED")).kind).toBe("already_verified");
    expect(classifyUploadError(http(409, "DUPLICATE_FILE")).kind).toBe("duplicate_file");
    expect(classifyUploadError(http(403)).kind).toBe("unauthorized");
    expect(classifyUploadError(http(400, "EXPIRY_REQUIRED")).kind).toBe("validation");
    expect(classifyUploadError(http(500)).kind).toBe("server");
  });

  it("describeIdentity covers every status", () => {
    for (const status of ["unverified", "pending", "verified", "rejected", "resubmission_required", "expired"] as const) {
      const c = describeIdentity({ status, reason: "because", expiresAt: null, daysUntilExpiry: null, expiringSoon: false, canUpload: true });
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(0);
    }
  });
});
