"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home, Search, Clock, User, ScanLine, Database } from "lucide-react";

import { DEFAULT_LANGUAGE_ID } from "@/data/languages";
import { getDashboardLabels } from "@/data/dashboard-labels";
import type { ScannedProduct } from "@/types/dashboard";
import { useAuth } from "@/components/AuthProvider";
import { WelcomeSection } from "@/components/dashboard/WelcomeSection";
import { ScanHeroCard } from "@/components/dashboard/ScanHeroCard";
import { SearchCard } from "@/components/dashboard/SearchCard";
import { RecentScans } from "@/components/dashboard/RecentScans";
import { PersonalizedInsight } from "@/components/dashboard/PersonalizedInsight";
import { HowItWorks } from "@/components/dashboard/HowItWorks";
import { TrustFooter } from "@/components/dashboard/TrustFooter";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { GamificationCard } from "@/components/dashboard/GamificationCard";
import { DailyChallengePreview } from "@/components/challenges/DailyChallengePreview";
import {
  TopNavigation,
  BottomNavigation,
} from "@/components/dashboard/Navigation";
import { apiUrl } from "@/lib/network/api-url";

const LANGUAGE_KEY = "app-preferred-language";

function getInitialLang(): string {
  try {
    return sessionStorage.getItem(LANGUAGE_KEY) ?? DEFAULT_LANGUAGE_ID;
  } catch {
    return DEFAULT_LANGUAGE_ID;
  }
}

const NAV_ITEMS = [
  { key: "home", label: "Home", href: "/", Icon: Home },
  { key: "search", label: "Search", href: "/search", Icon: Search },
  { key: "scan", label: "Scan", href: "/scan", Icon: ScanLine },
  { key: "history", label: "History", href: "/history", Icon: Clock },
  { key: "data", label: "Data", href: "/data", Icon: Database },
  { key: "profile", label: "Profile", href: "/profile", Icon: User },
];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("foodgaurd-token");
  } catch {
    return null;
  }
}

type UserData = {
  name: string;
  preferences: {
    healthGoals?: string[];
    allergies?: string[];
    avoidIngredients?: string[];
  } | null;
};

type HistoryItem = {
  id: string;
  productId: string | null;
  scannedAt: string;
  assessment?: string;
  score?: number;
  source?: string;
  product?: { name: string; category?: string } | null;
};

export function HomeDashboard() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<string>(getInitialLang);
  const labels = getDashboardLabels(lang);

  const [userName, setUserName] = useState("Guest");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [recentScans, setRecentScans] = useState<ScannedProduct[]>([]);
  const [concernSummary, setConcernSummary] = useState({ high: 0, moderate: 0, low: 0 });
  const [preferences, setPreferences] = useState<{ goal: string; focuses: string[] }>({ goal: "", focuses: [] });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getToken();
      if (!token) return;

      try {
        const meRes = await fetch(apiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const mePayload = await meRes.json() as { success: boolean; data: UserData };
          if (mePayload.success && !cancelled) {
            setUserName(mePayload.data.name || "Guest");
            const prefs = mePayload.data.preferences;
            if (prefs) {
              const goals = prefs.healthGoals ?? [];
              setAllergies(prefs.allergies ?? []);
              setPreferences({
                goal: goals[0] ? goals[0].replace(/_/g, " ") : "",
                focuses: [
                  ...(prefs.allergies?.length ? [`${prefs.allergies.length} allergen(s) noted`] : []),
                  ...(prefs.avoidIngredients?.length ? [`${prefs.avoidIngredients.length} ingredient(s) avoided`] : []),
                ],
              });
            }
          }
        }
      } catch { /* silent */ }

      try {
        const histRes = await fetch(apiUrl("/api/history?limit=5"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (histRes.ok) {
          const histPayload = await histRes.json() as { success: boolean; data: { history: HistoryItem[] } };
          if (histPayload.success && !cancelled) {
            const items = histPayload.data.history;
            const scans: ScannedProduct[] = items.map((h) => ({
              id: h.id,
              name: h.product?.name ?? h.productId ?? "Unknown product",
              category: (h.product?.category as ScannedProduct["category"]) ?? "food",
              concern: (h.assessment as ScannedProduct["concern"]) ?? "moderate",
              scannedAt: new Date(h.scannedAt).toLocaleDateString(),
              barcode: undefined,
            }));
            setRecentScans(scans);

            const summary = { high: 0, moderate: 0, low: 0 };
            for (const h of items) {
              const level = h.assessment ?? "moderate";
              if (level in summary) summary[level as keyof typeof summary]++;
            }
            setConcernSummary(summary);
          }
        }
      } catch { /* silent */ }
    }
    load();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleLanguageChange = useCallback((langId: string) => {
    setLang(langId);
    try {
      sessionStorage.setItem(LANGUAGE_KEY, langId);
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-nav-safe lg:pb-0">
      <TopNavigation
        currentLanguage={lang}
        onLanguageChange={handleLanguageChange}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-4 lg:gap-6">
          <section className="lg:rounded-2xl lg:overflow-hidden">
            <WelcomeSection
              labels={labels.greeting}
              userName={userName}
              allergies={allergies}
              scanCount={recentScans.length}
              healthyCount={concernSummary.low}
              onProfile={() => router.push("/profile")}
              onSettings={() => router.push("/profile")}
            />
          </section>

          <div className="flex flex-col gap-6">
            <SearchCard
              labels={labels.search}
              onClick={() => router.push("/search")}
            />
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <ScanHeroCard
                labels={labels.scan}
                onScan={() => router.push("/scan")}
              />
              <GamificationCard />
            </div>
            <DailyChallengePreview />
            <QuickActions />

            <div className="flex flex-col gap-5">
              <RecentScans
                labels={labels.recentScans}
                scans={recentScans}
                onViewAll={() => router.push("/history")}
                onScan={() => router.push("/scan")}
                hasScans={recentScans.length > 0}
              />
            </div>

            <section>
              <PersonalizedInsight
                labels={labels.personalized}
                preferences={preferences}
                onEdit={() => router.push("/profile")}
              />
            </section>

            <section>
              <HowItWorks labels={labels.howItWorks} />
            </section>

            <section className="pb-4">
              <TrustFooter message={labels.trust.message} />
            </section>
          </div>
        </div>
      </main>

      <BottomNavigation items={NAV_ITEMS} activeKey="home" />
    </div>
  );
}
