"use client";

import { useState, useRef, useEffect } from "react";
import { Home, User, Globe, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_LANGUAGES } from "@/data/languages";
import { useAuth } from "@/components/AuthProvider";
import { BrandMark } from "@/components/ui/BrandMark";

type NavItem = {
  key: string;
  label: string;
  href: string;
  Icon: typeof Home;
};

type TopNavigationProps = {
  currentLanguage?: string;
  onLanguageChange?: (langId: string) => void;
};

export function TopNavigation({
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
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Home">
          <BrandMark className="size-8" iconClassName="size-4" />
          <span className="text-sm font-semibold text-foreground">
            FoodGuard
          </span>
        </Link>

        <div className="flex items-center gap-1">
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
              className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
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
                  : "text-muted-foreground hover:text-foreground",
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
