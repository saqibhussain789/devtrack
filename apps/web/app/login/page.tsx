"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Brand } from "../../components/brand";
import { FormField } from "../../components/form-field";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-8 dark:border-stone-800 dark:bg-stone-900"
      >
        <Brand />

        <div>
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">Log in</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Welcome back.</p>
        </div>

        <FormField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>

        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          No account?{" "}
          <Link href="/register" className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
