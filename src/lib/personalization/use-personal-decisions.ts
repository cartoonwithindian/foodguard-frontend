/**
 * Pure orchestration behind `usePersonalDecisions`.
 *
 * The fan-out, merge, and staleness logic lives here — outside the hook — so
 * it can be unit-tested in this repo's node test environment (no DOM, no
 * testing-library). The hook handles only React concerns.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";
import {
  PersonalDecisionEngine,
  type PersonalDecision,
  type PersonalDecisionEngineOptions,
} from "@/lib/personalization/decision-engine";
import {
  decideAll,
  mergeOutcomes,
  pendingIds,
} from "@/lib/personalization/decision-orchestration";
import {
  buildUserFoodContext,
  emptyUserFoodContext,
  type UserFoodContext,
} from "@/lib/personalization/user-context";
import { readToday } from "@/lib/personalization/daily-log";
import type { UserPreferencesInput } from "@/types/domain";

export type PersonalDecisionState = {
  byProductId: Map<string, PersonalDecision>;
  loading: boolean;
  error: string | null;
  /** IDs currently being computed, so a single card can show a spinner. */
  pending: Set<string>;
  /** The context the current decisions were computed against. */
  context: UserFoodContext;
};

const EMPTY: PersonalDecisionState = {
  byProductId: new Map(),
  loading: false,
  error: null,
  pending: new Set(),
  context: emptyUserFoodContext(),
};

export type UsePersonalDecisionOptions = {
  engine?: PersonalDecisionEngine;
  engineOptions?: PersonalDecisionEngineOptions;
};

/**
 * Load the signed-in user's stored preferences.
 *
 * Unauthenticated or error responses resolve to `null` rather than throwing:
 * having no stored preferences is a normal state, and the decision engine is
 * built to produce an honest "not enough context" result from it.
 */
export async function fetchUserPreferences(): Promise<UserPreferencesInput | null> {
  try {
    const res = await fetch("/api/preferences", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { preferences?: UserPreferencesInput | null };
    return body.preferences ?? null;
  } catch {
    return null;
  }
}

/** Build the decision context from stored preferences + today's local log. */
export async function loadDecisionContext(): Promise<UserFoodContext> {
  const prefs = await fetchUserPreferences();
  return buildUserFoodContext({ prefs: prefs ?? undefined, today: readToday() });
}

export function usePersonalDecisions(
  profiles: ProductFoodProfile[],
  options: UsePersonalDecisionOptions = {},
) {
  const [state, setState] = useState<PersonalDecisionState>(EMPTY);
  const engineRef = useRef<PersonalDecisionEngine | null>(null);
  const reqId = useRef(0);

  const engine = useMemo(() => {
    if (options.engine) return options.engine;
    if (!engineRef.current) {
      engineRef.current = new PersonalDecisionEngine(options.engineOptions);
    }
    return engineRef.current;
  }, [options.engine, options.engineOptions]);

  const load = useCallback(
    async (force = false) => {
      if (profiles.length === 0) {
        setState(EMPTY);
        return;
      }
      const id = ++reqId.current;
      setState((s) => ({ ...s, loading: true, error: null, pending: pendingIds(profiles) }));

      try {
        const ctx = await loadDecisionContext();
        const outcomes = await decideAll(engine, profiles, ctx, { force });
        // A newer request already started; discard this stale result.
        if (reqId.current !== id) return;
        setState((s) => {
          const { byProductId, error } = mergeOutcomes(s.byProductId, outcomes);
          return {
            ...s,
            byProductId,
            loading: false,
            error,
            pending: new Set(),
            context: ctx,
          };
        });
      } catch (e: unknown) {
        if (reqId.current !== id) return;
        setState({
          ...EMPTY,
          error: e instanceof Error ? e.message : "Failed to load context",
        });
      }
    },
    [profiles, engine],
  );

  const refresh = useCallback(
    async (productId?: string) => {
      if (!productId) return load(true);
      const p = profiles.find((x) => x.productId === productId);
      if (!p) return;

      setState((s) => ({ ...s, error: null, pending: new Set([...s.pending, productId]) }));
      try {
        const ctx = await loadDecisionContext();
        const [outcome] = await decideAll(engine, [p], ctx, { force: true });
        setState((s) => {
          const pending = new Set(s.pending);
          pending.delete(productId);
          if (!outcome) return { ...s, pending };
          const merged = mergeOutcomes(s.byProductId, [outcome]);
          return { ...s, ...merged, pending, context: ctx };
        });
      } catch (e: unknown) {
        setState((s) => {
          const pending = new Set(s.pending);
          pending.delete(productId);
          return {
            ...s,
            error: e instanceof Error ? e.message : "Failed to recompute",
            pending,
          };
        });
      }
    },
    [profiles, engine, load],
  );

  // Decisions are computed only when the set of confirmed profiles changes —
  // never during a camera render, and never on every frame.
  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    state,
    getDecision: (productId: string) => state.byProductId.get(productId),
    isPending: (productId: string) => state.pending.has(productId),
    refresh,
    context: state.context,
  };
}
