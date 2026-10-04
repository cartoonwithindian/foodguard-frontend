"use client";

import { ScanLine, Cpu, Lightbulb, GitCompare } from "lucide-react";
import type { DashboardLabels } from "@/data/dashboard-labels";

type HowItWorksProps = {
  labels: DashboardLabels["howItWorks"];
};

const stepColors = [
  "bg-primary",
  "bg-primary/80",
  "bg-primary/60",
  "bg-primary/45",
];
const stepIcons = [ScanLine, Cpu, Lightbulb, GitCompare];

export function HowItWorks({ labels }: HowItWorksProps) {
  return (
    <section className="foodguard-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{labels.title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
        {labels.steps.map((step, i) => {
          const Icon = stepIcons[i] ?? ScanLine;
          return (
            <div key={step.number} className="flex flex-col items-center text-center">
              <div
                className={`mb-3 flex size-12 items-center justify-center rounded-2xl text-white ${stepColors[i] ?? stepColors[0]}`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <span className="text-[10px] font-bold tracking-[0.14em] text-primary">{step.number}</span>
              <p className="mt-1 text-sm font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
