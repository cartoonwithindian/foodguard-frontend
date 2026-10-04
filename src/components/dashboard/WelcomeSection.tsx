"use client";

import { Settings, ShieldCheck, ArrowUpRight } from "lucide-react";
import type { DashboardLabels } from "@/data/dashboard-labels";
import { BrandMark } from "@/components/ui/BrandMark";

type WelcomeSectionProps = {
  labels: DashboardLabels["greeting"];
  userName: string;
  allergies?: string[];
  scanCount?: number;
  healthyCount?: number;
  onProfile?: () => void;
  onSettings?: () => void;
};

export function WelcomeSection({
  labels,
  userName,
  allergies = [],
  scanCount = 0,
  healthyCount = 0,
  onProfile,
  onSettings,
}: WelcomeSectionProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <section className="foodguard-card overflow-hidden bg-primary-light/55">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:p-10">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark className="size-11 shadow-sm" iconClassName="size-5" />
            <span className="foodguard-eyebrow text-primary-dark">FoodGuard dashboard</span>
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting}, {userName}.
          </h1>
          <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">
            {labels.subtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onProfile}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              View my profile
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </button>
            {onSettings && (
              <button
                type="button"
                onClick={onSettings}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-primary-dark transition-colors hover:border-primary/30 hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Settings className="size-4" aria-hidden="true" />
                Settings
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Your food safety profile
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {allergies.length === 0 ? (
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                No allergies listed
              </span>
            ) : (
              allergies.slice(0, 4).map((allergy) => (
                <span
                  key={allergy}
                  className="rounded-full border border-primary/20 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary-dark"
                >
                  {allergy}
                </span>
              ))
            )}
            {allergies.length > 4 && (
              <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                +{allergies.length - 4} more
              </span>
            )}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-primary/10 pt-4 text-center">
            <div>
              <p className="text-lg font-semibold text-foreground">{scanCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Recent scans</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{healthyCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Lower concern</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{allergies.length}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Allergens</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
