"use client";

import { useState, useRef, useEffect } from "react";
import { Home, User, Globe, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_LANGUAGES } from "@/data/languages";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";

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
      className="hidden border-b border-border bg-card/80 backdrop-blur-md lg:block"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="Home">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-5 text-primary"
              aria-hidden="true"
            >
              <path
                d="M24 8c-2.5 0-4.5 2-4.5 4.5v2.2c-6.2 1.4-10.5 7-10.5 13.3 0 7.7 6.3 14 14 14s14-6.3 14-14c0-6.3-4.3-11.9-10.5-13.3V12.5C28.5 10 26.5 8 24 8z"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 22h8M24 18v8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="34" cy="34" r="7" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M38.5 38.5L42 42"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-foreground">
            FoodGuard
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {items.map(({ key, label, href, Icon }) => {
            const isActive = key === activeKey;
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Language selector */}
          {currentLanguage && onLanguageChange && (
          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setLangOpen((p) => !p);
                setProfileOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                      "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      currentLanguage === lang.id
                        ? "bg-primary/10 text-primary font-medium"
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

          {/* Profile menu */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((p) => !p);
                setLangOpen(false);
              }}
              className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Profile menu"
            >
              <User className="size-4" aria-hidden="true" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/20 bg-black text-white backdrop-blur-sm fixed-bottom-safe lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {items.map(({ key, label, href, Icon }) => {
          const isActive = key === activeKey;
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "text-primary"
                  : "text-white/60 hover:text-white",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
