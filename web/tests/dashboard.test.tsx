import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DashboardPage from "@/pages/app/dashboard/+Page";
import { useAuthStore } from "@/stores/auth-store";

describe("DashboardPage", () => {
  beforeEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("shows 'Welcome, there' when no user is set", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Welcome, there/)).toBeInTheDocument();
  });

  it("shows the user's first name when logged in", () => {
    useAuthStore.setState({
      user: {
        id: "1",
        email: "jane@example.com",
        first_name: "Jane",
        last_name: "Doe",
        role: "user",
        is_active: true,
        email_verified: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      isAuthenticated: true,
    });

    render(<DashboardPage />);
    expect(screen.getByText(/Welcome, Jane/)).toBeInTheDocument();
  });

  it("renders all stat cards", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Total Items")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
  });
});
