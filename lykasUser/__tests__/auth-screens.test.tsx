import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import LogInScreen from "../app/(auth)/logIn";
import SignUpScreen from "../app/(auth)/signUp";

jest.mock("../utils/api", () => {
  const actual = jest.requireActual("../utils/api");
  return {
    ...actual,
    api: { post: jest.fn(), get: jest.fn() },
  };
});

import { api } from "../utils/api";

describe("LogIn screen", () => {
  beforeEach(() => {
    jest.mocked(api.post).mockReset();
  });

  it("shows an error message when login fails with invalid credentials", async () => {
    jest.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "Invalid email or password" } },
    });

    render(<LogInScreen />);

    fireEvent.changeText(screen.getByTestId("login-email"), "wrong@example.com");
    fireEvent.changeText(screen.getByTestId("login-password"), "wrongpassword");
    fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() => expect(screen.getByText("Invalid email or password")).toBeTruthy());
  });

  it("shows a locked-account message when the account is locked", async () => {
    jest.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "Account is temporarily locked. Try again later." } },
    });

    render(<LogInScreen />);

    fireEvent.changeText(screen.getByTestId("login-email"), "locked@example.com");
    fireEvent.changeText(screen.getByTestId("login-password"), "password123");
    fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() => expect(screen.getByText(/temporarily locked/i)).toBeTruthy());
  });

  it("calls the login endpoint with the entered credentials", async () => {
    jest.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          user: { id: "1", displayName: "Test", email: "test@example.com", role: "user", status: "active" },
          accessToken: "access",
          refreshToken: "refresh",
        },
      },
    });

    render(<LogInScreen />);

    fireEvent.changeText(screen.getByTestId("login-email"), "test@example.com");
    fireEvent.changeText(screen.getByTestId("login-password"), "password123");
    fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/auth/login", { email: "test@example.com", password: "password123" })
    );
  });
});

describe("SignUp screen", () => {
  beforeEach(() => {
    jest.mocked(api.post).mockReset();
  });

  it("shows a client-side error when passwords don't match, without calling the API", async () => {
    render(<SignUpScreen />);

    fireEvent.changeText(screen.getByTestId("signup-name"), "Test User");
    fireEvent.changeText(screen.getByTestId("signup-email"), "test@example.com");
    fireEvent.changeText(screen.getByTestId("signup-password"), "password123");
    fireEvent.changeText(screen.getByTestId("signup-confirm"), "password456");
    fireEvent.press(screen.getByTestId("signup-submit"));

    await waitFor(() => expect(screen.getByText("Passwords don't match.")).toBeTruthy());
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows a client-side error when the password is too short, without calling the API", async () => {
    render(<SignUpScreen />);

    fireEvent.changeText(screen.getByTestId("signup-name"), "Test User");
    fireEvent.changeText(screen.getByTestId("signup-email"), "test@example.com");
    fireEvent.changeText(screen.getByTestId("signup-password"), "short");
    fireEvent.changeText(screen.getByTestId("signup-confirm"), "short");
    fireEvent.press(screen.getByTestId("signup-submit"));

    await waitFor(() => expect(screen.getByText(/at least 8 characters/i)).toBeTruthy());
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows a server error when the email is already registered", async () => {
    jest.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "An account with this email already exists" } },
    });

    render(<SignUpScreen />);

    fireEvent.changeText(screen.getByTestId("signup-name"), "Test User");
    fireEvent.changeText(screen.getByTestId("signup-email"), "dup@example.com");
    fireEvent.changeText(screen.getByTestId("signup-password"), "password123");
    fireEvent.changeText(screen.getByTestId("signup-confirm"), "password123");
    fireEvent.press(screen.getByTestId("signup-submit"));

    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeTruthy());
  });
});
