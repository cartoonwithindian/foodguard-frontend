"use client";

import { useEffect, useState } from "react";

type AnalysisLoadingProps = {
  title: string;
  description: string;
  stages: string[];
};

export function AnalysisLoading({
  title,
  description,
  stages,
}: AnalysisLoadingProps) {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (currentStage < stages.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStage((s) => s + 1);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentStage, stages.length]);

  return (
    <div className="foodguard-card flex flex-col items-center gap-6 p-8 text-center">
      <div className="relative size-16">
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {stages.map((stage, i) => (
          <div
            key={stage}
            className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
              i <= currentStage ? "opacity-100" : "opacity-30"
            }`}
          >
            <div
              className={`size-2 rounded-full transition-colors duration-300 ${
                i < currentStage
                  ? "bg-green-500"
                  : i === currentStage
                    ? "bg-primary animate-pulse"
                    : "bg-muted"
              }`}
            />
            <span className="text-foreground">{stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
