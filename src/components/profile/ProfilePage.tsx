"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { firebaseGetProfile, firebaseSaveProfile } from "@/lib/firebase/db";
import { apiUrl } from "@/lib/network/api-url";
import { firebaseUpdateDisplayName } from "@/lib/firebase/auth";
import { useSafeBack } from "@/lib/navigation/use-safe-back";
import { ProfileHeader } from "./ProfileHeader";
import { PersonalInfoSection } from "./PersonalInfoSection";
import { GoalsSection } from "./GoalsSection";
import { ProductPreferencesSection } from "./ProductPreferencesSection";
import { AnalysisPreferencesSection } from "./AnalysisPreferencesSection";
import { LanguageSection } from "./LanguageSection";
import { PrivacySection } from "./PrivacySection";
import { SecuritySection } from "./SecuritySection";
import { AccountActionsSection } from "./AccountActionsSection";
import { GamificationCard } from "@/components/dashboard/GamificationCard";
import {
  EMPTY_PROFILE,
  EMPTY_ANALYSIS_PREFS,
  EMPTY_PRIVACY,
  EMPTY_SECURITY_INFO,
  type UserProfile,
  type UserGoal,
  type GoalSubPreference,
  type ProductPreference,
  type AnalysisPreference,
  type PrivacySettings,
} from "@/data/profile-data";
import { getProfileLabels } from "@/data/profile-labels";

type ProfilePageProps = {
  lang?: string;
};

type AuthMe = {
  id: string;
  name: string;
  email: string;
  memberSince: string;
  language: string;
  preferences: {
    healthGoals?: string[];
    avoidIngredients?: string[];
    preferredIngredients?: string[];
    sensitivityPreferences?: string[];
  } | null;
};

function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("foodgaurd-token");
  } catch {
    return null;
  }
}

export function ProfilePage({ lang = "en" }: ProfilePageProps) {
  const router = useRouter();
  const goBack = useSafeBack("/");
  const t = getProfileLabels(lang);
  const { firebaseMode, firebaseUser, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [goal, setGoal] = useState<UserGoal>(null);
  const [goalPrefs, setGoalPrefs] = useState<GoalSubPreference[]>([]);
  const [productPrefs, setProductPrefs] = useState<ProductPreference[]>([]);
  const [analysisPrefs, setAnalysisPrefs] = useState<AnalysisPreference[]>(EMPTY_ANALYSIS_PREFS);
  const [privacy, setPrivacy] = useState<PrivacySettings>(EMPTY_PRIVACY);
  const [language, setLanguage] = useState(lang);

  useEffect(() => {
    if (firebaseMode) return;
    const token = getJwt();
    if (!token) return;

    let cancelled = false;
    void fetch(apiUrl("/api/users/me"), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { success: boolean; data?: AuthMe };
        const me = payload.data;
        if (!payload.success || !me || cancelled) return;

        setProfile({
          id: me.id,
          name: me.name,
          email: me.email,
          age: null,
          height: null,
          weight: null,
          memberSince: me.memberSince,
          accountStatus: "active",
        });
        if (me.language === "hi" || me.language === "en") {
          setLanguage(me.language);
          sessionStorage.setItem("app-preferred-language", me.language);
        }

        const backendGoal = me.preferences?.healthGoals?.[0];
        if (backendGoal && ["maintain_weight", "weight_loss", "weight_gain", "improve_nutrition", "general_awareness"].includes(backendGoal)) {
          setGoal(backendGoal as UserGoal);
        }
        const backendGoalPrefs = (me.preferences?.sensitivityPreferences ?? []).map((value) => ({
          key: value,
          label: value.replaceAll("_", " "),
          enabled: true,
        }));
        setGoalPrefs(backendGoalPrefs);
        setProductPrefs([
          ...(me.preferences?.avoidIngredients ?? []).map((value, index) => ({
            id: `avoid-${index}`,
            type: "avoid" as const,
            value,
          })),
          ...(me.preferences?.preferredIngredients ?? []).map((value, index) => ({
            id: `prefer-${index}`,
            type: "prefer" as const,
            value,
          })),
        ]);
      })
      .catch(() => {
        // Keep the page usable with explicit empty fields when the API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [firebaseMode]);

  useEffect(() => {
    if (!firebaseMode || !firebaseUser) return;
    let cancelled = false;
    void firebaseGetProfile(firebaseUser.uid).then((fbProfile) => {
      if (cancelled || !fbProfile) return;
      setProfile((prev) => ({
        ...prev,
        id: fbProfile.id,
        name: fbProfile.name || prev.name,
        email: fbProfile.email || firebaseUser.email || prev.email,
        memberSince: fbProfile.memberSince || prev.memberSince,
      }));
      if (fbProfile.language === "hi" || fbProfile.language === "en") {
        setLanguage(fbProfile.language);
        sessionStorage.setItem("app-preferred-language", fbProfile.language);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [firebaseMode, firebaseUser]);

  const handleSaveProfile = useCallback(
    (updated: UserProfile) => {
      setProfile(updated);
      if (firebaseMode && firebaseUser) {
        void firebaseSaveProfile(firebaseUser.uid, {
          name: updated.name,
          email: updated.email,
        });
        void firebaseUpdateDisplayName(updated.name);
      } else {
        const token = getJwt();
        if (token) {
          void fetch(apiUrl("/api/users/me"), {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: updated.name }),
          });
        }
      }
    },
    [firebaseMode, firebaseUser],
  );

  const persistBackendPreferences = useCallback((payload: Record<string, unknown>) => {
    if (firebaseMode) return;
    const token = getJwt();
    if (!token) return;
    void fetch(apiUrl("/api/users/me/preferences"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }, [firebaseMode]);

  const handleSaveGoals = useCallback((newGoal: UserGoal, newPrefs: GoalSubPreference[]) => {
    setGoal(newGoal);
    setGoalPrefs(newPrefs);
    persistBackendPreferences({
      healthGoals: newGoal ? [newGoal] : [],
      sensitivityPreferences: newPrefs.filter((pref) => pref.enabled).map((pref) => pref.key),
    });
  }, [persistBackendPreferences]);

  const handleSaveProductPrefs = useCallback((prefs: ProductPreference[]) => {
    setProductPrefs(prefs);
    persistBackendPreferences({
      avoidIngredients: prefs.filter((pref) => pref.type === "avoid").map((pref) => pref.value),
      preferredIngredients: prefs.filter((pref) => pref.type === "prefer").map((pref) => pref.value),
    });
  }, [persistBackendPreferences]);

  const handleSaveAnalysisPrefs = useCallback((prefs: AnalysisPreference[]) => {
    setAnalysisPrefs(prefs);
  }, []);

  const handleSavePrivacy = useCallback((settings: PrivacySettings) => {
    setPrivacy(settings);
  }, []);

  const handleLanguageChange = useCallback(
    (langId: string) => {
      setLanguage(langId);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("app-preferred-language", langId);
      }
      if (firebaseMode && firebaseUser) {
        void firebaseSaveProfile(firebaseUser.uid, { language: langId });
      }
    },
    [firebaseMode, firebaseUser],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={goBack}
            className="flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5 text-foreground" aria-hidden="true" />
          </button>
          <Settings className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-base font-semibold text-foreground">{t.header.title}</h1>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4 sm:space-y-5 sm:px-6 lg:pt-8">
        <ProfileHeader
          profile={profile}
          editProfileLabel={t.header.editProfile}
        />

        <GamificationCard />

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <PersonalInfoSection
            profile={profile}
            labels={t.personalInfo}
            onSave={handleSaveProfile}
          />

          <GoalsSection
            initialGoal={goal}
            initialPrefs={goalPrefs}
            labels={t.goals}
            onSave={handleSaveGoals}
          />

          <ProductPreferencesSection
            initialPrefs={productPrefs}
            labels={t.productPreferences}
            onSave={handleSaveProductPrefs}
          />

          <AnalysisPreferencesSection
            initialPrefs={analysisPrefs}
            labels={t.analysisPreferences}
            onSave={handleSaveAnalysisPrefs}
          />
        </div>

        <LanguageSection
          currentLanguage={language}
          labels={t.language}
          onChange={handleLanguageChange}
        />

        <PrivacySection
          initial={privacy}
          labels={t.privacy}
          onSave={handleSavePrivacy}
        />

        <SecuritySection
          info={EMPTY_SECURITY_INFO}
          labels={t.security}
        />

        <AccountActionsSection
          labels={t.accountActions}
          onLogout={() => {
            logout();
            router.push("/");
          }}
          onDeleteAccount={() => {}}
        />
      </main>
    </div>
  );
}
