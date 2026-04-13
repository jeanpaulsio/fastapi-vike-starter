import { useState } from "react";
import { navigate } from "vike/client/router";

import { APP_LOGO, APP_NAME } from "@/lib/app-config";
import { resetPassword } from "@/services/auth";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setError("Missing reset token");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      await navigate("/login");
    } catch {
      setError("Invalid or expired reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-white text-sm font-bold">
            {APP_LOGO}
          </div>
          <h1 className="text-xl font-extrabold text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Set a new password</p>
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
            <label
              htmlFor="reset-password-new"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              New Password
            </label>
            <input
              id="reset-password-new"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              required
              minLength={8}
            />
          </div>

          <div>
            <label
              htmlFor="reset-password-confirm"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Confirm Password
            </label>
            <input
              id="reset-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] px-4 py-2 text-sm font-bold text-white shadow-[0_0_12px_rgba(99,102,241,0.25)] disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
