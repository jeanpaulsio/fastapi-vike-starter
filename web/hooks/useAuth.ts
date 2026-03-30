import { useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "vike/client/router";

import { deleteCookie, getCookie } from "@/lib/cookies";
import type { User } from "@/lib/types";
import { getMe } from "@/services/auth";

/** React Query key for the current user. */
export const CURRENT_USER_KEY = ["currentUser"];

/**
 * Fetch the current user via React Query.
 * Only fires when an access_token cookie is present.
 */
export function useCurrentUser() {
  return useQuery<User>({
    queryKey: CURRENT_USER_KEY,
    queryFn: getMe,
    enabled: typeof window !== "undefined" && !!getCookie("access_token"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Returns a logout function that clears cookies, wipes the query cache,
 * and redirects to /login.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    deleteCookie("access_token");
    deleteCookie("refresh_token");
    queryClient.clear();
    navigate("/login");
  };
}
