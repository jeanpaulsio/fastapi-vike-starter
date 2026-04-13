/**
 * Integration test for the happy-path auth flow:
 *
 *    register -> verify-email -> login -> dashboard redirect
 *
 * This walks the full client-side state machine with every network boundary
 * (register, verifyEmail, login, getMe) mocked at the service layer. It is
 * deliberately **not** a unit test of any single page — the point is to prove
 * the pages wire through one another the way a real user would see them.
 *
 * Each mock here is self-contained: vitest does not share `vi.mock` calls
 * across test files, so integration tests each install their own mocks at the
 * top. That duplication is the price of not having flaky mock-state bleed.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Service mocks — all four auth endpoints and the /users/me call.
vi.mock("@/services/auth", () => ({
  register: vi.fn(),
  verifyEmail: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  refreshToken: vi.fn(),
}));

// Navigation mock — we assert against the last navigation target.
const navigateMock = vi.fn();
vi.mock("vike/client/router", () => ({
  navigate: (...args: unknown[]) => navigateMock(...args),
}));

// Cookie helpers — set/get spies, real in-memory store so the login ->
// useCurrentUser enable flag can flip true.
const cookieJar: Record<string, string> = {};
vi.mock("@/lib/cookies", () => ({
  setCookie: vi.fn((name: string, value: string) => {
    cookieJar[name] = value;
  }),
  getCookie: vi.fn((name: string) => cookieJar[name]),
  deleteCookie: vi.fn((name: string) => {
    delete cookieJar[name];
  }),
}));

// Import AFTER the mocks are declared so the pages pick up the stubs.
import { login, register, verifyEmail } from "@/services/auth";
import LoginPage from "@/pages/login/+Page";
import RegisterPage from "@/pages/register/+Page";
import VerifyEmailPage from "@/pages/verify-email/+Page";

const registerMock = vi.mocked(register);
const verifyEmailMock = vi.mocked(verifyEmail);
const loginMock = vi.mocked(login);

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("auth flow: register -> verify -> login -> dashboard", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    navigateMock.mockReset();
    registerMock.mockReset();
    verifyEmailMock.mockReset();
    loginMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("register page submits the form and shows the check-email state", async () => {
    registerMock.mockResolvedValueOnce({
      message: "Check your email for a verification link",
      requires_verification: true,
    });

    renderWithQuery(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    });
    // Password + Confirm Password both match /password/i, so use exact-match labels.
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith("jane@example.com", "Jane", "Doe", "password123");
    });
    // Success state replaces the form with a Check your email heading.
    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
  });

  it("verify-email page reads the token from the query string and calls the service", async () => {
    verifyEmailMock.mockResolvedValueOnce({ message: "You are all set." });
    // Stub window.location.search before the page mounts.
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...originalLocation, search: "?token=tok-abc123" },
    });

    renderWithQuery(<VerifyEmailPage />);

    await waitFor(() => {
      expect(verifyEmailMock).toHaveBeenCalledWith("tok-abc123");
    });
    // The success heading is a fixed string in the component; the API message
    // renders below it. Target the heading so we don't collide with the body.
    expect(await screen.findByRole("heading", { name: /email verified/i })).toBeInTheDocument();
    expect(screen.getByText(/you are all set\./i)).toBeInTheDocument();

    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it("login page stores tokens in cookies and navigates to the dashboard", async () => {
    loginMock.mockResolvedValueOnce({
      access_token: "access-token-xyz",
      refresh_token: "refresh-token-xyz",
      token_type: "bearer",
    });
    navigateMock.mockResolvedValueOnce(undefined);

    renderWithQuery(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("jane@example.com", "password123");
    });

    await waitFor(() => {
      expect(cookieJar.access_token).toBe("access-token-xyz");
      expect(cookieJar.refresh_token).toBe("refresh-token-xyz");
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/app/dashboard");
    });
  });

  it("login surfaces a 403 verification error from the API", async () => {
    const err = Object.assign(new Error("Forbidden"), {
      isAxiosError: true,
      response: { status: 403 },
    });
    loginMock.mockRejectedValueOnce(err);

    renderWithQuery(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "unverified@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/verify your email/i);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
