import axios from "axios";
import * as Sentry from "@sentry/react";

import { deleteCookie, getCookie, setCookie } from "@/lib/cookies";

const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ""}/api`,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach access token as Bearer header
apiClient.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  const token = getCookie("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 by attempting refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest.url?.startsWith("/auth/");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const refreshToken = getCookie("refresh_token");

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${import.meta.env.VITE_API_URL ?? ""}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          setCookie("access_token", data.access_token, 30 * 60);
          setCookie("refresh_token", data.refresh_token, 7 * 24 * 60 * 60);
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(originalRequest);
        } catch {
          deleteCookie("access_token");
          deleteCookie("refresh_token");
          window.location.href = "/login";
        }
      } else {
        deleteCookie("access_token");
        window.location.href = "/login";
      }
    }

    // Report unexpected API errors (not 401s, not auth endpoints) to Sentry
    const status = error.response?.status;
    if (status && status !== 401 && !isAuthEndpoint && status >= 500) {
      Sentry.captureException(error, {
        tags: { api_status: status, api_url: originalRequest.url },
      });
    }

    return Promise.reject(error);
  },
);

export default apiClient;
