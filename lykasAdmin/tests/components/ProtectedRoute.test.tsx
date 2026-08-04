import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../src/context/AuthContext";
import ProtectedRoute from "../../src/components/layout/ProtectedRoute";
import { tokenStore } from "../../src/services/api";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

import { api } from "../../src/services/api";

function renderProtected(roles?: ("staff" | "admin" | "super_admin")[]) {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute roles={roles}>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.mocked(api.get).mockReset();
  });

  it("redirects to /login when there is no session", async () => {
    renderProtected();
    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
  });

  it("renders children when the user has an allowed role", async () => {
    tokenStore.setTokens("access-token", "refresh-token");
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { user: { id: "1", displayName: "Staff Sam", email: "sam@example.com", role: "staff", status: "active" } } },
    });

    renderProtected(["staff", "admin"]);

    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
  });

  it("shows a not-authorized message when the user's role isn't in the allowed list", async () => {
    tokenStore.setTokens("access-token", "refresh-token");
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { user: { id: "1", displayName: "Regular Staff", email: "staff@example.com", role: "staff", status: "active" } } },
    });

    renderProtected(["super_admin"]);

    await waitFor(() => expect(screen.getByText("Not authorized")).toBeInTheDocument());
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("super_admin always passes a role check, mirroring the backend's wildcard convention", async () => {
    tokenStore.setTokens("access-token", "refresh-token");
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { user: { id: "1", displayName: "Root", email: "root@example.com", role: "super_admin", status: "active" } } },
    });

    renderProtected(["staff"]);

    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
  });

  it("clears the session and redirects when /api/auth/me fails (e.g. expired token)", async () => {
    tokenStore.setTokens("stale-token", "stale-refresh");
    vi.mocked(api.get).mockRejectedValue(new Error("401"));

    renderProtected();

    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
    expect(tokenStore.getAccessToken()).toBeNull();
  });
});
