"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { Brand } from "../../components/brand";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", enabled: true },
  { href: "/dashboard/projects", label: "Projects", enabled: true },
  { href: "/dashboard/deployments", label: "Deployments", enabled: false },
  { href: "/dashboard/settings", label: "Settings", enabled: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-500 dark:text-stone-400">Loading…</p>
      </div>
    );
  }

  const workspace = user.memberships[0]?.workspace;
  const role = user.memberships[0]?.role;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-col border-r border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900 sm:flex">
        <div className="mb-8">
          <Brand />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.enabled ? item.href : "#"}
                aria-disabled={!item.enabled}
                className={[
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200"
                    : item.enabled
                      ? "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                      : "cursor-not-allowed text-stone-300 dark:text-stone-700",
                ].join(" ")}
              >
                {item.label}
                {!item.enabled && (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-400 dark:bg-stone-800">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4 dark:border-stone-800 dark:bg-stone-900">
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{workspace?.name}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">{role}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{user.name}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{user.email}</p>
            </div>
            <button
              onClick={() => logout().then(() => router.replace("/login"))}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 bg-stone-50 p-6 dark:bg-stone-950">{children}</main>
      </div>
    </div>
  );
}
