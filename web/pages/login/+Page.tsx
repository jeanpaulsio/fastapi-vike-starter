import { useState } from "react";
import axios from "axios";
import { navigate } from "vike/client/router";
import { useQueryClient } from "@tanstack/react-query";

import { APP_LOGO, APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { setCookie } from "@/lib/cookies";
import { login } from "@/services/auth";
import { CURRENT_USER_KEY } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tokens = await login(email, password);
      setCookie("access_token", tokens.access_token, 30 * 60);
      setCookie("refresh_token", tokens.refresh_token, 7 * 24 * 60 * 60);

      // Invalidate so useCurrentUser refetches on the next page
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
      await navigate("/app/dashboard");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid email or password");
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("Please verify your email before logging in");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = [
    "w-full rounded-lg border px-3 py-2 text-sm text-foreground outline-none transition-colors",
    error
      ? "border-destructive bg-destructive/5 focus:border-destructive"
      : "border-border bg-input focus:border-primary",
  ].join(" ");

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-white text-sm font-bold">
            {APP_LOGO}
          </div>
          <h1 className="text-xl font-extrabold text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{APP_TAGLINE}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-center text-xs font-medium text-destructive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              className={inputClass}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] px-4 py-2 text-sm font-bold text-white shadow-[0_0_12px_rgba(99,102,241,0.25)] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center text-xs text-muted-foreground">
          <p>
            <a href="/forgot-password" className="text-primary hover:underline">
              Forgot your password?
            </a>
          </p>
          <p>
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-primary hover:underline">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
