import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdoptionForm from "../../src/pages/AdoptionForm";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn() },
  };
});

import { api } from "../../src/services/api";

const AVAILABLE_PETS = [{ _id: "pet1", name: "Bantay", species: "Dog", status: "Available" }];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/adoptions/new"]}>
      <Routes>
        <Route path="/adoptions/new" element={<AdoptionForm />} />
        <Route path="/adoptions" element={<div>Adoptions list</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdoptionForm page", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { data: AVAILABLE_PETS } });
  });

  it("loads available pets into the pet selector", async () => {
    renderPage();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pets", { params: { status: "Available", limit: 100 } }));
    expect(await screen.findByText("Bantay (Dog)")).toBeInTheDocument();
  });

  it("submits the application with the entered values and navigates back to the list", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

    renderPage();
    await screen.findByText("Bantay (Dog)");

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Pet"), "pet1");
    await user.type(screen.getByLabelText("Phone"), "0917000000");
    await user.type(screen.getByLabelText("Address"), "123 Main St");

    await user.click(screen.getByRole("button", { name: /submit application/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/applications",
        expect.objectContaining({ pet: "pet1", phone: "0917000000", address: "123 Main St", type: "adoption" })
      )
    );

    await waitFor(() => expect(screen.getByText("Adoptions list")).toBeInTheDocument());
  });

  it("shows the foster-period field only when the application type is foster", async () => {
    renderPage();
    await screen.findByText("Bantay (Dog)");

    expect(screen.queryByLabelText("Foster period")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Application type"), "foster");

    expect(screen.getByLabelText("Foster period")).toBeInTheDocument();
  });

  it("shows an error message when submission fails, without navigating away", async () => {
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "This pet is not currently available" } },
    });

    renderPage();
    await screen.findByText("Bantay (Dog)");

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Pet"), "pet1");
    await user.type(screen.getByLabelText("Phone"), "0917000000");
    await user.type(screen.getByLabelText("Address"), "123 Main St");
    await user.click(screen.getByRole("button", { name: /submit application/i }));

    await waitFor(() => expect(screen.getByText(/not currently available/i)).toBeInTheDocument());
    expect(screen.queryByText("Adoptions list")).not.toBeInTheDocument();
  });
});
