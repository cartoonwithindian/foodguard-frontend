import { describe, it, expect } from "vitest";
import { acceptInterpretation, downgradesConstraint } from "@/lib/personalization/jev-gate";
import { containsBannedClaim, JEVInputSchema } from "@/lib/personalization/jev-contract";

const clean = {
  explanation: "This serving uses most of your remaining sugar budget today.",
  priorityFactors: ["Uses 80% of your remaining sugar today."],
  evidence: ["Sugar: 24g per serving, 20g consumed today, 50g target"],
};

const accept = (o: { explanation: string; priorityFactors?: string[]; evidence?: string[] }, hard = false) =>
  acceptInterpretation(
    { priorityFactors: [], evidence: [], ...o },
    { hardConstraintViolation: hard, containsBannedClaim },
  );

describe("server-side JEV acceptance gate", () => {
  it("accepts a clean interpretation when nothing conflicts", () => {
    expect(accept(clean)).toEqual({ ok: true });
  });

  describe("cannot soften a proven hard-constraint violation", () => {
    it("rejects a hedge about an avoided ingredient", () => {
      const r = accept(
        { explanation: "This is probably fine in small amounts." },
        true,
      );
      expect(r).toMatchObject({ ok: false, code: "JEV_OVERRODE_CONSTRAINT" });
    });

    it.each([
      "Probably safe for you.",
      "This is likely fine.",
      "Not a big concern.",
      "Should be ok occasionally.",
      "You can have this in small amounts.",
    ])("rejects: %s", (explanation) => {
      expect(accept({ explanation }, true)).toMatchObject({ ok: false });
    });

    it("rejects a hedge hidden in a priority factor", () => {
      const r = accept(
        { explanation: "Contains peanuts.", priorityFactors: ["Probably not an issue."] },
        true,
      );
      expect(r).toMatchObject({ ok: false, code: "JEV_OVERRODE_CONSTRAINT" });
    });

    it("accepts an honest statement of the conflict", () => {
      const r = accept(
        {
          explanation:
            "This contains peanuts, which you listed as an allergy. That is based on the ingredient list.",
          priorityFactors: ["Contains peanuts"],
        },
        true,
      );
      expect(r).toEqual({ ok: true });
    });

    it("does not apply hedge filtering when no violation was proven", () => {
      // "Probably" is fine when there is no constraint to talk away.
      expect(accept({ explanation: "This is probably more than you planned." }, false)).toEqual({
        ok: true,
      });
    });
  });

  describe("rejects claims the layer may not make", () => {
    it.each([
      "This is a healthy choice for you.",
      "You should avoid this.",
      "I recommend this product.",
      "Unhealthy for your goals.",
      "This is a 87/100 for you.",
      "I would give this a score of 9.",
    ])("rejects: %s", (explanation) => {
      expect(accept({ explanation })).toMatchObject({ ok: false, code: "JEV_BANNED_CLAIM" });
    });

    it("rejects a claim hidden in the evidence array", () => {
      const r = accept({
        explanation: "Neutral phrasing.",
        evidence: ["Rated highly for you."],
      });
      expect(r).toMatchObject({ ok: false, code: "JEV_BANNED_CLAIM" });
    });
  });

  it("prefers reporting an override over a generic claim when both apply", () => {
    const r = accept({ explanation: "Probably fine and healthy." }, true);
    expect(r).toMatchObject({ code: "JEV_OVERRODE_CONSTRAINT" });
  });

  it("downgradesConstraint is independent of the claim list", () => {
    expect(downgradesConstraint("This is a healthy choice")).toBe(false);
    expect(downgradesConstraint("This should be fine")).toBe(true);
  });
});

describe("JEV input schema is a hard privacy boundary", () => {
  const valid = {
    product: { name: "Corn Flakes", ingredients: ["Corn"], servingSize: "30g", nutritionBasis: "PER_100G" },
    userContext: { goals: ["lower_sugar"], dietaryPreferences: [], today: { available: true, itemsLogged: 1, date: "2026-09-28" } },
    deterministicAnalysis: {
      fit: "MEDIUM",
      impacts: [],
      hardConstraintViolation: false,
      hardConstraintReasons: [],
      deterministicReasons: [],
      uncertainties: [],
    },
  };

  it("accepts a conforming payload", () => {
    expect(JEVInputSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["userId", "email", "token", "authHeader", "user_id"])(
    "rejects a payload carrying %s rather than silently stripping it",
    (field) => {
      const result = JEVInputSchema.safeParse({ ...valid, [field]: "secret" });
      expect(result.success).toBe(false);
    },
  );

  it("rejects an identity field nested in userContext", () => {
    const result = JEVInputSchema.safeParse({
      ...valid,
      userContext: { ...valid.userContext, userId: "secret" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an extra field on a single impact", () => {
    const result = JEVInputSchema.safeParse({
      ...valid,
      deterministicAnalysis: {
        ...valid.deterministicAnalysis,
        impacts: [
          {
            key: "totalSugar",
            label: "Sugar",
            unit: "g",
            productAmount: 24,
            consumedBefore: 20,
            target: 50,
            remainingBefore: 30,
            remainingAfter: 6,
            shareOfRemaining: 0.8,
            unavailableReason: null,
            // A provider-computed "score" must not be accepted here.
            aiScore: 87,
          },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it("has no field that could carry the full food log", () => {
    const result = JEVInputSchema.safeParse({
      ...valid,
      userContext: { ...valid.userContext, today: { ...valid.userContext.today, consumedFoods: [] } },
    });
    expect(result.success).toBe(false);
  });
});
