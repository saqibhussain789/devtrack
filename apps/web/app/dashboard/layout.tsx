"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { NotificationsProvider } from "../../lib/notifications-context";
import { Brand } from "../../components/brand";
import { NotificationBell } from "../../components/notifications/notification-bell";
import { ThemeToggle } from "../../components/theme-toggle";

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
        <p className="text-ink-muted">Loading…</p>
      </div>
    );
  }

  const workspace = user.memberships[0]?.workspace;
  const role = user.memberships[0]?.role;

  return (
    <NotificationsProvider>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-border bg-surface p-6 sm:flex">
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
                      ? "bg-brand/10 text-brand"
                      : item.enabled
                        ? "text-ink-muted hover:bg-border/40"
                        : "cursor-not-allowed text-ink-muted/50",
                  ].join(" ")}
                >
                  {item.label}
                  {!item.enabled && (
                    <span className="rounded bg-border/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">{workspace?.name}</p>
              <p className="text-xs text-ink-muted">{role}</p>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="text-right">
                <p className="text-sm font-medium text-ink">{user.name}</p>
                <p className="text-xs text-ink-muted">{user.email}</p>
              </div>
              <button
                onClick={() => logout().then(() => router.replace("/login"))}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-border/40"
              >
                Log out
              </button>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 bg-canvas p-6">{children}</main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
