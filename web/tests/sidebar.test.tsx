import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import type { User } from "@/lib/types";

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({ urlPathname: "/app/dashboard" }),
}));

vi.mock("vike/client/router", () => ({
  navigate: vi.fn(),
}));

const mockLogout = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useCurrentUser: vi.fn(),
  useLogout: () => mockLogout,
  CURRENT_USER_KEY: ["currentUser"],
}));

import { useCurrentUser } from "@/hooks/useAuth";
import type { Mock } from "vitest";
const mockedUseCurrentUser = useCurrentUser as Mock;

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

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Sidebar", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockedUseCurrentUser.mockReturnValue({ data: mockUser });
  });

  it("renders all nav items", () => {
    renderWithQuery(<Sidebar open={true} onClose={vi.fn()} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("displays user name", () => {
    renderWithQuery(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("displays user initials", () => {
    renderWithQuery(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("shows placeholder when no user is loaded", () => {
    mockedUseCurrentUser.mockReturnValue({ data: undefined });
    renderWithQuery(<Sidebar open={true} onClose={vi.fn()} />);

    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("calls onClose when nav link is clicked", () => {
    const onClose = vi.fn();
    renderWithQuery(<Sidebar open={true} onClose={onClose} />);

    fireEvent.click(screen.getByText("Items"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls logout on sign out click", () => {
    renderWithQuery(<Sidebar open={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Sign out"));
    expect(mockLogout).toHaveBeenCalled();
  });
});
