"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Search,
  ScanLine,
  MessagesSquare,
  History,
  UserRound,
  LogOut,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { BrandMark } from "@/components/ui/BrandMark";
import { cn } from "@/lib/utils";

/**
 * The one navigation system.
 *
 * Desktop (`lg` and up): fixed dark sidebar.
 * Mobile/tablet: compact top bar plus bottom tab bar for the primary
 * destinations. Previously two independent nav systems (this sidebar and
 * `dashboard/Navigation.tsx`) produced different active states and different
 * mobile layouts per page — pages now render inside this shell instead.
 */

const PRIMARY_NAV = [
  { label: "Home", href: "/", Icon: Home },
  { label: "Search", href: "/search", Icon: Search },
  { label: "Scan", href: "/scan", Icon: ScanLine },
  { label: "Chat", href: "/assistant", Icon: MessagesSquare },
  { label: "History", href: "/history", Icon: History },
] as const;

const PROGRESS_NAV = [
  { label: "Achievements", href: "/gamification", Icon: Trophy },
  { label: "Challenges", href: "/challenges", Icon: Target },
] as const;

const ACCOUNT_NAV = [{ label: "Profile", href: "/profile", Icon: UserRound }] as const;

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function shouldHideShell(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/auth" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/admin")
  );
}

/** Bottom tab bar destinations (subset of the primary nav, per mobile UX). */
const MOBILE_TABS = PRIMARY_NAV.filter((item) =>
  ["Home", "Scan", "Chat", "History", "Search"].includes(item.label),
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  if (shouldHideShell(pathname)) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const renderNavLink = ({
    label,
    href,
    Icon,
  }: {
    label: string;
    href: string;
    Icon: React.ComponentType<{ className?: string }>;
  }) => {
    const active = isLinkActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          "min-h-[44px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active
            ? "bg-sidebar-active text-white"
            : "text-sidebar-foreground hover:bg-white/10 hover:text-white",
        )}
      >
        <Icon
          className={cn(
            "size-[18px] shrink-0",
            active ? "text-white" : "text-sidebar-foreground/75 group-hover:text-primary-light",
          )}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
        {label === "Scan" && (
          <span className="ml-auto rounded-full bg-primary/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-light">
            Start
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="FoodGuard home"
        >
          <BrandMark className="size-10 bg-primary" iconClassName="size-5" />
          <span className="text-[17px] font-semibold tracking-tight text-white">FoodGuard</span>
        </Link>

        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Main navigation">
          <p className="foodguard-eyebrow px-3 pb-2 text-sidebar-foreground/60">Workspace</p>
          {PRIMARY_NAV.map(renderNavLink)}

          <p className="foodguard-eyebrow px-3 pb-2 pt-6 text-sidebar-foreground/60">
            Your progress
          </p>
          {PROGRESS_NAV.map(renderNavLink)}

          <p className="foodguard-eyebrow px-3 pb-2 pt-6 text-sidebar-foreground/60">Account</p>
          {ACCOUNT_NAV.map(renderNavLink)}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut className="size-[18px] text-sidebar-foreground/75" aria-hidden="true" />
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Sparkles className="size-[18px] text-sidebar-foreground/75" aria-hidden="true" />
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/95 px-4 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2.5" aria-label="FoodGuard home">
          <BrandMark className="size-8 shrink-0" iconClassName="size-4" />
          <span className="truncate text-sm font-semibold text-foreground">FoodGuard</span>
        </Link>
        {isAuthenticated ? (
          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Profile and settings"
            >
              <UserRound className="size-5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Log out"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Sign in
          </Link>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="min-h-screen lg:pl-64">
        {/*
          * Reserve space for the mobile tab bar on normal scrolling pages.
          * The chat page is a fixed-height layout that fits itself between the
          * bars, so it opts out and manages its own bottom clearance.
          */}
        <div
          className={
            pathname.startsWith("/assistant")
              ? "lg:pb-0"
              : "pb-[calc(env(safe-area-inset-bottom)+4.5rem)] lg:pb-0"
          }
        >
          {children}
        </div>
      </div>

      {/* ── Mobile bottom navigation ────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Primary navigation"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
          {MOBILE_TABS.map(({ label, href, Icon }) => {
            const active = isLinkActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
