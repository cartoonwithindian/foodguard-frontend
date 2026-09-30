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
  Settings2,
  LogOut,
  Sparkles,
  Target,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { BrandMark } from "@/components/ui/BrandMark";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { label: "Home", href: "/", Icon: Home },
  { label: "Search Products", href: "/search", Icon: Search },
  { label: "Scan Product", href: "/scan", Icon: ScanLine },
  { label: "Chat with FoodGuard", href: "/assistant", Icon: MessagesSquare },
  { label: "History", href: "/history", Icon: History },
  { label: "Profile", href: "/profile", Icon: UserRound },
];

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

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <Link href="/" className="flex items-center gap-3 px-3 py-2" aria-label="FoodGuard home">
          <BrandMark className="size-10 bg-primary" iconClassName="size-5" />
          <span className="text-[17px] font-semibold tracking-tight text-white">FoodGuard</span>
        </Link>

        <div className="mt-10 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/60">
            Your food safety workspace
          </p>
        </div>

        <nav className="mt-3 flex-1 space-y-1" aria-label="Main navigation">
          {primaryLinks.map(({ label, href, Icon }) => {
            const active = isLinkActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "bg-sidebar-active text-white shadow-sm"
                    : "text-sidebar-foreground hover:bg-white/7 hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "size-[18px] shrink-0",
                    active ? "text-white" : "text-sidebar-foreground/75 group-hover:text-primary-light",
                  )}
                  aria-hidden="true"
                />
                <span>{label}</span>
                {label === "Scan Product" && (
                  <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-light">
                    Start
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-4">
          <Link
            href="/challenges"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground transition-colors hover:bg-white/7 hover:text-white"
          >
            <Target className="size-[18px] text-sidebar-foreground/75" aria-hidden="true" />
            Challenges
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground transition-colors hover:bg-white/7 hover:text-white"
          >
            <Settings2 className="size-[18px] text-sidebar-foreground/75" aria-hidden="true" />
            Settings
          </Link>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-sidebar-foreground transition-colors hover:bg-white/7 hover:text-white"
            >
              <LogOut className="size-[18px] text-sidebar-foreground/75" aria-hidden="true" />
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground transition-colors hover:bg-white/7 hover:text-white"
            >
              <Sparkles className="size-[18px] text-sidebar-foreground/75" aria-hidden="true" />
              Sign in
            </Link>
          )}
        </div>

      </aside>

      <div className="min-h-screen lg:pl-64">{children}</div>
    </div>
  );
}
