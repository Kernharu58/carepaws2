import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PetManagement from "../../src/pages/PetManagement";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
  };
});

import { api } from "../../src/services/api";

const PETS = [
  { _id: "pet1", name: "Bantay", species: "Dog", status: "Available" },
  { _id: "pet2", name: "Luna", species: "Cat", status: "Adopted" },
];

function mockListEndpoint() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/api/pets/admin") {
      return Promise.resolve({ data: { data: PETS, pagination: { total: 2, page: 1, limit: 20, pages: 1 } } });
    }
    if (url.startsWith("/api/pets/")) {
      return Promise.resolve({
        data: { data: { _id: "pet1", name: "Bantay", species: "Dog", status: "Available", healthStatus: "", description: "" } },
      });
    }
    if (url.startsWith("/api/shelter-care/summary/")) {
      return Promise.resolve({ data: { data: { latestHealth: null, latestFeeding: null, activeCage: null, activeQuarantine: null } } });
    }
    if (url.startsWith("/api/medical/summary/")) {
      return Promise.resolve({ data: { data: { vaccinations: [], vetVisits: [], records: [] } } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

describe("PetManagement page", () => {
  beforeEach(() => {
    vi.mocked(api.get)?.mockReset?.();
    mockListEndpoint();
  });

  it("renders the pet list and a prompt to select a pet before anything is chosen", async () => {
    render(
      <MemoryRouter initialEntries={["/pets/management"]}>
        <PetManagement />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Bantay")).toBeInTheDocument());
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.getByText(/select a pet from the list/i)).toBeInTheDocument();
  });

  it("loads and displays a pet's detail panel once selected", async () => {
    render(
      <MemoryRouter initialEntries={["/pets/management"]}>
        <PetManagement />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Bantay")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByText("Bantay"));

    await waitFor(() => expect(screen.getByText("Bantay's profile")).toBeInTheDocument());
    expect(screen.getByText("Shelter-floor care")).toBeInTheDocument();
    expect(screen.getByText("Medical records")).toBeInTheDocument();
  });

  it("saves profile changes via PUT /api/pets/:id", async () => {
    render(
      <MemoryRouter initialEntries={["/pets/management"]}>
        <PetManagement />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Bantay")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByText("Bantay"));
    await waitFor(() => expect(screen.getByText("Bantay's profile")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(expect.stringContaining("/api/pets/pet1"), expect.any(FormData), expect.any(Object));
    });
  });
});
