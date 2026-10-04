"use client";

import { Check, Sparkles, Target, X } from "lucide-react";
import type { ChallengeCompletion } from "@/services/challenge.service";

type ChallengeCompleteDialogProps = {
  challenge: ChallengeCompletion;
  onClose: () => void;
};

export function ChallengeCompleteDialog({ challenge, onClose }: ChallengeCompleteDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-sidebar/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenge-complete-title"
    >
      <div className="foodguard-card relative w-full max-w-sm bg-card p-7 text-center shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close challenge completion"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <Target className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary-dark">Challenge complete</p>
        <h2 id="challenge-complete-title" className="mt-2 text-xl font-semibold text-foreground">
          {challenge.name}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{challenge.description}</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Sparkles className="size-4" aria-hidden="true" />
          +{challenge.xp_reward} XP
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Check className="size-3.5 text-primary" aria-hidden="true" />
          Saved to your FoodGuard history
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
