"use client";

import { Camera, ImagePlus, ScanLine } from "lucide-react";
import type { DashboardLabels } from "@/data/dashboard-labels";

type ScanHeroCardProps = {
  labels: DashboardLabels["scan"];
  onScan: () => void;
};

export function ScanHeroCard({ labels, onScan }: ScanHeroCardProps) {
  return (
    <section className="foodguard-card flex h-full flex-col p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="foodguard-eyebrow text-primary">Primary action</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {labels.title}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {labels.subtitle}
          </p>
        </div>
        <div className="hidden size-12 items-center justify-center rounded-2xl bg-primary-light text-primary sm:flex">
          <ScanLine className="size-6" aria-hidden="true" />
        </div>
      </div>

      <button
        type="button"
        onClick={onScan}
        className="group mt-7 flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/35 bg-secondary/65 px-6 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary-light/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
          <ImagePlus className="size-5" aria-hidden="true" />
        </span>
        <span className="mt-4 text-sm font-semibold text-foreground">
          Upload an image or use your camera
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          We&apos;ll identify the product before showing food safety insights.
        </span>
        <span className="mt-4 inline-flex items-center gap-2.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors group-hover:bg-primary-hover">
          <Camera className="size-4 shrink-0" aria-hidden="true" />
          {labels.scanButton}
        </span>
      </button>
    </section>
  );
}
