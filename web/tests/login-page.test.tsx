import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginPage from "@/pages/login/+Page";

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/services/auth", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  getMe: vi.fn(),
}));

vi.mock("vike/client/router", () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  CURRENT_USER_KEY: ["currentUser"],
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function getEmailInput(): HTMLInputElement {
  return document.querySelector('input[type="email"]') as HTMLInputElement;
}

function getPasswordInput(): HTMLInputElement {
  return document.querySelector('input[type="password"]') as HTMLInputElement;
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(getEmailInput(), { target: { value: email } });
  fireEvent.change(getPasswordInput(), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("renders the login form", () => {
    renderWithQuery(<LoginPage />);

    expect(getEmailInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows loading state while submitting", async () => {
    mockLogin.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<LoginPage />);
    fillAndSubmit("test@example.com", "password");

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent("Signing in...");
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  it("calls login and navigates on success", async () => {
    const tokens = {
      access_token: "at",
      refresh_token: "rt",
      token_type: "bearer",
    };
    mockLogin.mockResolvedValue(tokens);
    mockNavigate.mockResolvedValue(undefined);

    renderWithQuery(<LoginPage />);
    fillAndSubmit("test@example.com", "password123");

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
      expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard");
    });
  });

  it("displays an error message on 401 login failure", async () => {
    const axiosError = Object.assign(new Error("401"), {
      isAxiosError: true,
      response: { status: 401 },
    });
    mockLogin.mockRejectedValue(axiosError);

    renderWithQuery(<LoginPage />);
    fillAndSubmit("bad@email.com", "wrong");

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });
});
