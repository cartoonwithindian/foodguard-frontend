"use client";

import { useState, useRef, useEffect } from "react";
import { Home, User, Globe, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_LANGUAGES } from "@/data/languages";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { BrandMark } from "@/components/ui/BrandMark";

type NavItem = {
  key: string;
  label: string;
  href: string;
  Icon: typeof Home;
};

type TopNavigationProps = {
  items: NavItem[];
  activeKey: string;
  currentLanguage?: string;
  onLanguageChange?: (langId: string) => void;
};

export function TopNavigation({
  items,
  activeKey,
  currentLanguage,
  onLanguageChange,
}: TopNavigationProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { logout } = useAuth();

  const currentLang = APP_LANGUAGES.find((l) => l.id === currentLanguage) ?? APP_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className="border-b border-border bg-card/90 backdrop-blur-md lg:hidden"
      aria-label="Main navigation"
    >
      {/*
        * The bar carries three groups — brand, tablet shortcuts, and the
        * account controls — in a single non-wrapping row, so every group is
        * `shrink-0` except the brand, which is allowed to ellipsize. Without
        * that the row's min-content width (brand + 5 links + theme switch +
        * language + avatar) exceeds the viewport below `lg` and pushes the
        * avatar past the right edge, which is what made the document 30px
        * wider than a 390px screen.
        */}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 shrink items-center gap-2.5"
          aria-label="Home"
        >
          <BrandMark className="size-8 shrink-0" iconClassName="size-4" />
          <span className="truncate text-sm font-semibold text-foreground">
            FoodGuard
          </span>
        </Link>

        {/*
          * Tablet-only shortcuts. From `md` to `lg` the row is only 720px wide
          * and still has to hold the theme switch, language and avatar, so the
          * labels collapse to their icons and stay available to screen readers.
          */}
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {items.map(({ key, label, href, Icon }) => {
            const isActive = key === activeKey;
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors lg:px-3",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only lg:not-sr-only">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Below `sm` the three 44px theme targets do not fit beside the
              language and account controls, so they move into the account menu
              (mirrored there with `sm:hidden`). */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {currentLanguage && onLanguageChange && (
          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setLangOpen((p) => !p);
                setProfileOpen(false);
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-haspopup="true"
              aria-expanded={langOpen}
            >
              <Globe className="size-4" aria-hidden="true" />
              <span className="text-xs font-medium">{currentLang.nativeLabel}</span>
              <ChevronDown className="size-3" aria-hidden="true" />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                {APP_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      onLanguageChange(lang.id);
                      setLangOpen(false);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      currentLanguage === lang.id
                        ? "bg-primary-light text-primary-dark font-medium"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span>{lang.nativeLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((p) => !p);
                setLangOpen(false);
              }}
              className="group flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Profile menu"
              aria-haspopup="true"
              aria-expanded={profileOpen}
            >
              {/* 44px hit area around the 32px avatar so the touch target meets
                  the minimum without growing the circle in the bar. */}
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors group-hover:bg-primary-hover">
                <User className="size-4" aria-hidden="true" />
              </span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <div className="border-b border-border p-2 sm:hidden">
                  <ThemeToggle className="w-full justify-between" />
                </div>
                <Link
                  href="/profile"
                  className="flex min-h-11 items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export function BottomNavigation({
  items,
  activeKey,
}: {
  items: NavItem[];
  activeKey: string;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {items.map(({ key, label, href, Icon }) => {
          const isActive = key === activeKey;
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
