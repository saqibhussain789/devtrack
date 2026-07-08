"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Brand } from "../../components/brand";
import { FormField } from "../../components/form-field";
import { GithubOAuthButton } from "../../components/github-oauth-button";
import { ThemeToggle } from "../../components/theme-toggle";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register(name, email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-border bg-surface p-8"
      >
        <Brand />

        <div>
          <h1 className="text-xl font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-muted">
            You&apos;ll get a workspace of your own to start.
          </p>
        </div>

        <FormField id="name" label="Name" type="text" value={name} onChange={setName} autoComplete="name" />
        <FormField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />

        {error && <p className="text-sm text-status-blocked">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>

        <GithubOAuthButton />

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:text-brand/80">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
