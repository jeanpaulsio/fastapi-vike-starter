import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "@/pages/app/+Layout";

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({ urlPathname: "/app/dashboard" }),
}));

vi.mock("vike/client/router", () => ({
  navigate: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useCurrentUser: () => ({
    data: {
      id: "1",
      email: "jane@example.com",
      first_name: "Jane",
      last_name: "Doe",
      role: "user",
      is_active: true,
      email_verified: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    isError: false,
  }),
  useLogout: () => vi.fn(),
  CURRENT_USER_KEY: ["currentUser"],
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("AppLayout", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders children and sidebar", () => {
    renderWithQuery(
      <AppLayout>
        <div data-testid="page-content">Page</div>
      </AppLayout>,
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders mobile menu button", () => {
    renderWithQuery(
      <AppLayout>
        <div>Page</div>
      </AppLayout>,
    );

    const buttons = screen.getAllByRole("button", { name: /open sidebar/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("toggles sidebar on mobile menu click", async () => {
    renderWithQuery(
      <AppLayout>
        <div>Page</div>
      </AppLayout>,
    );

    const menuButtons = screen.getAllByRole("button", { name: /open sidebar/i });
    fireEvent.click(menuButtons[0]);

    await waitFor(() => {
      const overlay = document.querySelector('[aria-label="Close sidebar"]');
      expect(overlay).not.toBeNull();
    });
  });
});
