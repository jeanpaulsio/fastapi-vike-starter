import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({ urlPathname: "/app/dashboard" }),
}));

vi.mock("vike/client/router", () => ({
  navigate: vi.fn(),
}));

const mockUser = {
  id: "1",
  email: "jane@example.com",
  first_name: "Jane",
  last_name: "Doe",
  role: "user" as const,
  is_active: true,
  email_verified: true,
  created_at: "2026-01-01T00:00:00Z",
};

describe("Sidebar", () => {
  beforeEach(() => {
    cleanup();
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  it("renders all nav items", () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("displays user name", () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("displays user initials", () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("shows placeholder when no user is loaded", () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    render(<Sidebar open={true} onClose={vi.fn()} />);

    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("calls onClose when nav link is clicked", () => {
    const onClose = vi.fn();
    render(<Sidebar open={true} onClose={onClose} />);

    fireEvent.click(screen.getByText("Items"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls logout on sign out click", () => {
    const logoutSpy = vi.fn();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, logout: logoutSpy });

    render(<Sidebar open={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Sign out"));
    expect(logoutSpy).toHaveBeenCalled();
  });
});
