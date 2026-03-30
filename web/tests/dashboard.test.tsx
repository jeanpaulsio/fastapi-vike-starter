import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "@/pages/app/dashboard/+Page";
import type { User } from "@/lib/types";

const mockUser: User = {
  id: "1",
  email: "jane@example.com",
  first_name: "Jane",
  last_name: "Doe",
  role: "user",
  is_active: true,
  email_verified: true,
  created_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/hooks/useAuth", () => ({
  useCurrentUser: vi.fn(),
  useLogout: () => vi.fn(),
  CURRENT_USER_KEY: ["currentUser"],
}));

import { useCurrentUser } from "@/hooks/useAuth";
import type { Mock } from "vitest";
const mockedUseCurrentUser = useCurrentUser as Mock;

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("DashboardPage", () => {
  beforeEach(() => {
    cleanup();
  });

  it("shows 'Welcome, there' when no user is loaded", () => {
    mockedUseCurrentUser.mockReturnValue({ data: undefined });
    renderWithQuery(<DashboardPage />);
    expect(screen.getByText(/Welcome, there/)).toBeInTheDocument();
  });

  it("shows the user's first name when logged in", () => {
    mockedUseCurrentUser.mockReturnValue({ data: mockUser });
    renderWithQuery(<DashboardPage />);
    expect(screen.getByText(/Welcome, Jane/)).toBeInTheDocument();
  });

  it("renders all stat cards", () => {
    mockedUseCurrentUser.mockReturnValue({ data: undefined });
    renderWithQuery(<DashboardPage />);
    expect(screen.getByText("Total Items")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
  });
});
