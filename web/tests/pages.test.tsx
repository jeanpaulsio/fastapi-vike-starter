import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { APP_NAME } from "@/lib/app-config";
import { Head } from "@/pages/+Head";
import LandingPage from "@/pages/index/+Page";
import ItemsPage from "@/pages/app/items/+Page";
import TeamPage from "@/pages/app/team/+Page";
import SettingsPage from "@/pages/app/settings/+Page";

vi.mock("@/services/items", () => ({
  listItems: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, has_more: false }),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
}));

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

describe("Head", () => {
  it("renders viewport meta tag", () => {
    render(<Head />);
    const meta = document.querySelector('meta[name="viewport"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute("content")).toBe("width=device-width, initial-scale=1.0");
  });
});

describe("LandingPage", () => {
  it("renders branding and sign in link", () => {
    render(<LandingPage />);
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Sign In").closest("a")).toHaveAttribute("href", "/login");
  });
});

describe("ItemsPage", () => {
  it("renders heading", () => {
    render(withQueryClient(<ItemsPage />));
    expect(screen.getByText("Items")).toBeInTheDocument();
  });
});

describe("TeamPage", () => {
  it("renders heading", () => {
    render(<TeamPage />);
    expect(screen.getByText("Team")).toBeInTheDocument();
  });
});

describe("SettingsPage", () => {
  it("renders heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
