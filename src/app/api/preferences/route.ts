/**
 * GET /api/preferences — the signed-in user's stored food preferences.
 *
 * Phase 5 reads this to build `UserFoodContext`. It exists because the store
 * abstraction is server-side and keyed by userId, so the client cannot call
 * `getUserPreferences()` directly.
 *
 * The response is deliberately limited to the fields the decision engine is
 * allowed to see: dietary flags, declared allergies, restrictions, avoided
 * ingredients, and stated goals. It returns no user id, email, or session
 * data, so a client holding this payload cannot re-identify the account, and
 * the JEV layer never receives it in this form.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { UserPreferencesInput } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession(request);

  // No preferences yet is a normal state, not an error: the UI simply has
  // less personal context to reason with.
  if (!session) {
    return NextResponse.json({ preferences: null });
  }

  try {
    const record = await getStore().getUserPreferences(session.id);
    if (!record) {
      return NextResponse.json({ preferences: null });
    }

    const preferences: UserPreferencesInput = {
      vegetarian: record.vegetarian,
      vegan: record.vegan,
      allergies: record.allergies,
      dietaryRestrictions: record.dietaryRestrictions,
      avoidIngredients: record.avoidIngredients,
      healthGoals: record.healthGoals,
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load preferences" },
      { status: 500 },
    );
  }
}
