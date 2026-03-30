import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/lib/cookies", () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  getMe: vi.fn(),
}));

vi.mock("vike/client/router", () => ({
  navigate: vi.fn(),
}));

import { useCurrentUser, useLogout, CURRENT_USER_KEY } from "@/hooks/useAuth";
import { getCookie, deleteCookie } from "@/lib/cookies";
import { getMe } from "@/services/auth";
import { navigate } from "vike/client/router";
import type { Mock } from "vitest";

const mockedGetCookie = getCookie as Mock;
const mockedGetMe = getMe as Mock;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useAuth hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCurrentUser does not fetch when no access_token cookie", () => {
    mockedGetCookie.mockReturnValue(undefined);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(mockedGetMe).not.toHaveBeenCalled();
  });

  it("useCurrentUser fetches when access_token cookie exists", async () => {
    const mockUser = {
      id: "123",
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      role: "user" as const,
      is_active: true,
      email_verified: true,
      created_at: "2026-01-01T00:00:00Z",
    };
    mockedGetCookie.mockReturnValue("test-token");
    mockedGetMe.mockResolvedValue(mockUser);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    // Wait for query to resolve
    await vi.waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.email).toBe("test@example.com");
  });

  it("useLogout clears cookies and navigates to /login", () => {
    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });

    result.current();

    expect(deleteCookie).toHaveBeenCalledWith("access_token");
    expect(deleteCookie).toHaveBeenCalledWith("refresh_token");
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("CURRENT_USER_KEY is exported for cache invalidation", () => {
    expect(CURRENT_USER_KEY).toEqual(["currentUser"]);
  });
});
