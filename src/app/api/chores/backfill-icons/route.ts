import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { RuleSuggestionProvider } from "../../../../lib/suggest";
import { getActiveHouseholdId } from "../../../../lib/household";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot backfill: walk every chore in the active household, if icon is the
// default ("broom") and the title suggests a better match, update in place.
// Caller must be authed; cheap operation since RuleSuggestionProvider is pure.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await getActiveHouseholdId();
  const provider = new RuleSuggestionProvider();
  const chores = await prisma.chore.findMany({ where: { householdId } });

  let updated = 0;
  for (const c of chores) {
    const s = provider.suggest(c.title);
    const nextIcon = c.icon === "broom" && s.icon ? s.icon : c.icon;
    const nextCategory = c.category === "cleaning" && s.category ? s.category : c.category;
    if (nextIcon !== c.icon || nextCategory !== c.category) {
      await prisma.chore.update({
        where: { id: c.id },
        data: { icon: nextIcon, category: nextCategory }
      });
      updated++;
    }
  }
  return NextResponse.json({ ok: true, scanned: chores.length, updated });
}
