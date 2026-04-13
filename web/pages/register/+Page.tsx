import { useState } from "react";

import { APP_LOGO, APP_NAME } from "@/lib/app-config";
import { register } from "@/services/auth";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await register(email, firstName, lastName, password);
      setSuccess(result.message);
    } catch {
      setError("Registration failed. This email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-white text-sm font-bold">
            {APP_LOGO}
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">{success}</p>
          <a href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-white text-sm font-bold">
            {APP_LOGO}
          </div>
          <h1 className="text-xl font-extrabold text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Create your account</p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="register-first-name"
                className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                First Name
              </label>
              <input
                id="register-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label
                htmlFor="register-last-name"
                className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Last Name
              </label>
              <input
                id="register-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Password
            </label>
            <input
              id="register-password"
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
              htmlFor="register-confirm-password"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
