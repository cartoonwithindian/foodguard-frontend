import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PersonalDecisionEngine,
  resetDecisionCacheForTesting,
} from "@/lib/personalization/decision-engine";
import type { JEVAdapter, JEVResult } from "@/lib/personalization/jev-adapter";
import type { JEVInput, JEVOutput } from "@/lib/personalization/jev-contract";
import { buildUserFoodContext, type UserFoodContext } from "@/lib/personalization/user-context";
import { defaultDailyTargets } from "@/lib/personalization/daily-targets";
import type { ProductFoodProfile } from "@/lib/multi-scan/food-profile";

function profile(overrides: Partial<ProductFoodProfile> = {}): ProductFoodProfile {
  return {
    detectionId: "d1",
    productId: "p1",
    productName: "Corn Flakes",
    brand: null,
    image: null,
    barcode: "123",
    servingSize: "30g",
    nutrition: {
      basis: "PER_100G",
      calories: { value: 110, unit: "kcal" },
      carbohydrates: null,
      totalSugar: { value: 80, unit: "g" },
      addedSugar: null,
      protein: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      sodium: null,
    },
    ingredients: { rawText: "Corn, Sugar", normalized: ["Corn", "Sugar"] },
    categories: ["food"],
    understanding: null,
    understandingSource: "unavailable",
    source: "test",
    fetchedAt: 1,
    status: "ready",
    ...overrides,
  };
}

function ctxWith(sugar: number): UserFoodContext {
  return buildUserFoodContext({
    prefs: { healthGoals: ["lower_sugar"] },
    today: {
      available: true,
      date: "2026-09-28",
      consumedFoods: sugar
        ? [{ productId: "prev", productName: "Tea", at: 1, servings: 1, nutrients: { totalSugar: sugar } }]
        : [],
      consumedNutrition: sugar ? { totalSugar: sugar } : {},
    },
    dailyTargets: defaultDailyTargets(),
  });
}

const ctxConflict = () =>
  buildUserFoodContext({
    prefs: { avoidIngredients: ["sugar"] },
    today: { available: true, date: "2026-09-28", consumedFoods: [], consumedNutrition: {} },
    dailyTargets: defaultDailyTargets(),
  });

const goodOutput = (over: Partial<JEVOutput> = {}): JEVOutput => ({
  explanation: "This uses most of your remaining sugar budget today.",
  priorityFactors: ["Uses 80% of your remaining sugar today."],
  evidence: ["Sugar: 24g per serving, 20g consumed today, 50g target"],
  uncertainties: [],
  ...over,
});

function stubAdapter(result: JEVResult | ((i: JEVInput) => JEVResult)) {
  const interpret = vi.fn(async (input: JEVInput) =>
    typeof result === "function" ? result(input) : result,
  );
  const adapter: JEVAdapter = { interpret };
  return { adapter, interpret };
}

const OK: JEVResult = { ok: true, interpretation: goodOutput(), source: "mock" };

describe("PersonalDecisionEngine", () => {
  beforeEach(() => resetDecisionCacheForTesting());

  // ── Case 10 ──
  it("case 10 — accepts a valid JEV response and labels its source", async () => {
    const { adapter } = stubAdapter(OK);
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
    expect(d.explanation).toBe("This uses most of your remaining sugar budget today.");
    expect(d.explanationSource).toBe("ai");
    expect(d.jevStatus).toEqual({ state: "ok", source: "mock" });
  });

  // ── Case 11 ──
  it("case 11 — a malformed JEV response falls back to deterministic text", async () => {
    const { adapter } = stubAdapter({
      ok: true,
      // Missing every field — fails JEVOutputSchema.
      interpretation: { nonsense: true } as unknown as JEVOutput,
      source: "qwen",
    });
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
    expect(d.explanationSource).toBe("deterministic");
    expect(d.jevStatus.state).toBe("unavailable");
    // Deterministic numbers are still fully available (Step 18).
    expect(d.analysis.impacts.find((i) => i.key === "totalSugar")?.remainingAfter).toBe(6);
    expect(d.evidence.length).toBeGreaterThan(0);
  });

  // ── Case 12 ──
  it("case 12 — a JEV timeout degrades to the deterministic explanation", async () => {
    const { adapter } = stubAdapter({
      ok: false,
      code: "jev_timeout",
      message: "Personalized AI interpretation temporarily unavailable.",
    });
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
    expect(d.explanationSource).toBe("deterministic");
    expect(d.jevStatus).toEqual({ state: "unavailable", code: "jev_timeout" });
    expect(d.fit).not.toBe("UNKNOWN"); // deterministic result still stands
  });

  // ── Case 13 ──
  it("case 13 — deterministic fallback keeps product facts and evidence visible", async () => {
    const { adapter } = stubAdapter({ ok: false, code: "jev_error", message: "down" });
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
    expect(d.evidence.some((e) => e.kind === "product_fact")).toBe(true);
    expect(d.evidence.some((e) => e.kind === "calculation")).toBe(true);
    expect(d.reasoningChain.length).toBeGreaterThan(3);
    expect(d.reasoningChain.at(-1)?.kind).toBe("interpretation");
  });

  it("works with interpretation switched off entirely", async () => {
    const d = await new PersonalDecisionEngine({ deterministicOnly: true }).decide(
      profile(),
      ctxWith(20),
    );
    expect(d.explanationSource).toBe("deterministic");
    expect(d.jevStatus.state).toBe("unavailable");
  });

  // ══ THE CENTRAL GUARANTEE ══
  describe("JEV cannot override hard constraints", () => {
    it("keeps the violation and CONFLICT fit even when JEV says it is fine", async () => {
      const { adapter } = stubAdapter({
        ok: true,
        interpretation: goodOutput({
          explanation: "This is probably fine, only a small amount of sugar.",
        }),
        source: "qwen",
      });
      const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxConflict());
      expect(d.hardConstraintViolation).toBe(true);
      expect(d.fit).toBe("CONFLICT");
      // The hedging interpretation is discarded, not shown.
      expect(d.explanation).not.toMatch(/probably fine/i);
      expect(d.jevStatus).toEqual({ state: "rejected", code: "contradicts_constraint" });
    });

    it("never lets JEV change the fit band", async () => {
      const { adapter } = stubAdapter(
        OK, // a perfectly well-formed, polite response
      );
      const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxConflict());
      expect(d.fit).toBe("CONFLICT");
      expect(d.hardConstraintViolation).toBe(true);
      expect(d.headline).toMatch(/conflicts/i);
    });

    it("discards a JEV response containing a health claim", async () => {
      const { adapter } = stubAdapter({
        ok: true,
        interpretation: goodOutput({ explanation: "This is a healthy choice for you." }),
        source: "qwen",
      });
      const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
      expect(d.jevStatus).toEqual({ state: "rejected", code: "banned_claim" });
      expect(d.explanation).not.toMatch(/healthy/i);
    });

    it("discards an invented 0-100 score", async () => {
      const { adapter } = stubAdapter({
        ok: true,
        interpretation: goodOutput({ explanation: "I would rate this 87/100." }),
        source: "qwen",
      });
      const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
      expect(d.jevStatus.state).toBe("rejected");
      expect(d.explanation).not.toMatch(/87/);
    });

    it("JEV is never asked to arbitrate: the violation ships in its input", async () => {
      const { adapter, interpret } = stubAdapter(OK);
      await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxConflict());
      const sent = interpret.mock.calls[0][0] as JEVInput;
      expect(sent.deterministicAnalysis.hardConstraintViolation).toBe(true);
      expect(sent.deterministicAnalysis.hardConstraintReasons.length).toBeGreaterThan(0);
    });
  });

  // ── Case 21: privacy ──
  describe("JEV input carries no user identity or private fields", () => {
    it("sends only the allowlisted structured context", async () => {
      const { adapter, interpret } = stubAdapter(OK);
      await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
      const body = JSON.stringify(interpret.mock.calls[0][0]);
      expect(body).not.toMatch(/userId|user_id|email|token|password|auth/i);
      // The full consumed-food list is reduced to a count.
      expect(body).not.toMatch(/"consumedFoods"/);
      expect((interpret.mock.calls[0][0] as JEVInput).userContext.today.itemsLogged).toBe(1);
    });
  });

  // ── Case 14 ──
  it("case 14 — handles multiple products independently", async () => {
    const { adapter } = stubAdapter((i) =>
      i.product.name === "B" ? { ok: false, code: "jev_error", message: "x" } : OK,
    );
    const engine = new PersonalDecisionEngine({ jev: adapter });
    const [a, b, c] = await Promise.all([
      engine.decide(profile({ productId: "a", productName: "A" }), ctxWith(20), { force: true }),
      engine.decide(profile({ productId: "b", productName: "B" }), ctxWith(20), { force: true }),
      engine.decide(profile({ productId: "c", productName: "C" }), ctxWith(20), { force: true }),
    ]);
    expect(a!.jevStatus.state).toBe("ok");
    expect(b!.jevStatus.state).toBe("unavailable");
    expect(c!.jevStatus.state).toBe("ok");
    // One failure does not suppress the others' evidence.
    expect(b!.evidence.length).toBeGreaterThan(0);
  });

  it("concurrent decisions do not leak a rejection onto a healthy sibling", async () => {
    // Regression: rejection state used to live on the engine instance, so a
    // parallel batch could label a clean product as rejected.
    const { adapter } = stubAdapter((i) =>
      i.product.name === "BAD"
        ? {
            ok: true,
            interpretation: goodOutput({ explanation: "This is a healthy choice." }),
            source: "qwen",
          }
        : OK,
    );
    const engine = new PersonalDecisionEngine({ jev: adapter });
    const results = await Promise.all(
      ["OK1", "BAD", "OK2", "OK3"].map((name) =>
        engine.decide(profile({ productId: name, productName: name }), ctxWith(20), {
          force: true,
        }),
      ),
    );
    const byName = new Map(results.map((r) => [r.productName, r]));
    expect(byName.get("BAD")!.jevStatus).toEqual({
      state: "rejected",
      code: "banned_claim",
    });
    for (const name of ["OK1", "OK2", "OK3"]) {
      expect(byName.get(name)!.jevStatus.state).toBe("ok");
      expect(byName.get(name)!.explanation).toBe(
        "This uses most of your remaining sugar budget today.",
      );
    }
  });

  // ── Case 15 + Step 19: cache invalidation on context change ──
  it("case 15 — changing the day's intake invalidates the cached decision", async () => {
    const { adapter, interpret } = stubAdapter(OK);
    const engine = new PersonalDecisionEngine({ jev: adapter });
    const p = profile();

    const first = await engine.decide(p, ctxWith(20));
    expect(first.fromCache).toBe(false);
    const sugarAfterFirst = first.analysis.impacts.find((i) => i.key === "totalSugar")!.remainingAfter;
    expect(sugarAfterFirst).toBe(6);

    // Same context → served from cache, no second JEV call.
    const second = await engine.decide(p, ctxWith(20));
    expect(second.fromCache).toBe(true);
    expect(interpret).toHaveBeenCalledTimes(1);

    // User eats more sugar → different decision, JEV called again.
    const third = await engine.decide(p, ctxWith(40));
    expect(third.fromCache).toBe(false);
    expect(interpret).toHaveBeenCalledTimes(2);
    expect(third.analysis.impacts.find((i) => i.key === "totalSugar")!.remainingAfter).toBe(-14);
  });

  it("force bypasses the cache", async () => {
    const { adapter, interpret } = stubAdapter(OK);
    const engine = new PersonalDecisionEngine({ jev: adapter });
    await engine.decide(profile(), ctxWith(20));
    await engine.decide(profile(), ctxWith(20), { force: true });
    expect(interpret).toHaveBeenCalledTimes(2);
  });

  it("changing a goal invalidates the decision", async () => {
    const { adapter, interpret } = stubAdapter(OK);
    const engine = new PersonalDecisionEngine({ jev: adapter });
    const p = profile();
    await engine.decide(
      p,
      buildUserFoodContext({
        prefs: { healthGoals: ["lower_sugar"] },
        today: { available: true, date: "d", consumedFoods: [], consumedNutrition: {} },
        dailyTargets: defaultDailyTargets(),
      }),
    );
    await engine.decide(
      p,
      buildUserFoodContext({
        prefs: { healthGoals: ["higher_protein"] },
        today: { available: true, date: "d", consumedFoods: [], consumedNutrition: {} },
        dailyTargets: defaultDailyTargets(),
      }),
    );
    expect(interpret).toHaveBeenCalledTimes(2);
  });

  // ── Case 17 ──
  it("case 17 — the reasoning chain shows the arithmetic, not a mystery score", async () => {
    const { adapter } = stubAdapter(OK);
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
    const chain = d.reasoningChain;
    expect(chain.map((s) => s.kind)).toEqual([
      "context",
      "product",
      "calculation",
      "target",
      "result",
      "interpretation",
    ]);
    expect(chain[0].value).toMatch(/20g sugar consumed today/);
    expect(chain[1].value).toMatch(/24g sugar per serving/);
    expect(chain[2].value).toBe("20 + 24 = 44g");
    expect(chain[3].value).toMatch(/50g per day/);
    expect(chain[4].value).toMatch(/6g remaining/);
    expect(chain[5].isAi).toBe(true);
  });

  it("chain marks unavailable values instead of faking them", async () => {
    const { adapter } = stubAdapter(OK);
    const p = profile({
      servingSize: null,
      nutrition: { ...profile().nutrition, totalSugar: null },
    });
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(
      p,
      buildUserFoodContext({ prefs: { healthGoals: ["lower_sugar"] } }),
    );
    expect(d.reasoningChain.some((s) => s.unavailable === true)).toBe(true);
  });

  // ── Case 18 ──
  it("case 18 — fit stays internally consistent with the deterministic numbers", async () => {
    const { adapter } = stubAdapter(OK);
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
    const s = d.analysis.impacts.find((i) => i.key === "totalSugar")!;
    // Whatever the band, it must agree with the arithmetic behind it.
    if (d.fit === "CONFLICT") expect(d.hardConstraintViolation).toBe(true);
    else expect(d.hardConstraintViolation).toBe(false);
    expect(s.shareOfRemaining).toBe(0.8);
  });

  it("produces a JSON-serializable result for Phase 6 handoff", async () => {
    const { adapter } = stubAdapter(OK);
    const d = await new PersonalDecisionEngine({ jev: adapter }).decide(profile(), ctxWith(20));
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });
});
