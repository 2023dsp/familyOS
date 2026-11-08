import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { sendToHousehold } from "./push";

/**
 * Purchase research agent: when a chore is flagged as a purchase, Claude
 * searches the web (server-side web_search / web_fetch tools) and writes a
 * list of product links that fit the household's purchase rules into
 * Chore.researchResult. Runs in the background inside the long-lived Next
 * server process; status is tracked on the row so the UI can poll.
 */

export const DEFAULT_PURCHASE_RULES = `- Deliver to Belgium. Prefer shops with fast delivery to Belgium: bol.com, Amazon (amazon.com.be, amazon.de, amazon.fr, amazon.nl), then brand shops / EU retailers with quick shipping.
- Anything in contact with skin (clothes, blankets, bedding, textiles, pads) MUST be manufactured in Europe. Verify the "made in" on the brand site or product page; a European brand producing in China does not qualify.
- For everything else prefer European brands and European manufacturing; if no European-made option exists, say so plainly and pick the best-quality, safety-tested option, stating where it is made.
- No cheap, low-quality, unbranded marketplace products ("not some chinese crap"). Prefer natural materials and recognised certifications (OEKO-TEX, GOTS, EN 71, CE) where relevant.
- Family: Davide, Luize and their daughter Ellie (3 years old).`;

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";
const STALE_MS = 30 * 60 * 1000; // a "running" row older than this is considered dead (e.g. server restart)
const MAX_CONTINUATIONS = 6;

const inflight = new Set<string>();

function rulesKey(householdId: string) {
  return `h_${householdId}_purchase_rules`;
}

export async function getPurchaseRules(householdId: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: rulesKey(householdId) } });
  return row?.value?.trim() || DEFAULT_PURCHASE_RULES;
}

export async function setPurchaseRules(householdId: string, rules: string | null): Promise<void> {
  const key = rulesKey(householdId);
  if (!rules || !rules.trim()) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.appSetting.upsert({ where: { key }, update: { value: rules.trim() }, create: { key, value: rules.trim() } });
}

export function researchConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

/** True when a research run for this chore may be (re)started now. */
export function canStartResearch(chore: { id: string; researchStatus: string | null; updatedAt: Date }): boolean {
  if (inflight.has(chore.id)) return false;
  if (chore.researchStatus === "running" || chore.researchStatus === "pending") {
    return Date.now() - chore.updatedAt.getTime() > STALE_MS;
  }
  return true;
}

/** Marks the chore pending and kicks off research in the background. */
export async function startResearch(choreId: string): Promise<void> {
  if (inflight.has(choreId)) return;
  if (!researchConfigured()) {
    await prisma.chore.update({
      where: { id: choreId },
      data: { researchStatus: "error", researchError: "ANTHROPIC_API_KEY is not configured on the server." }
    });
    return;
  }
  inflight.add(choreId);
  await prisma.chore.update({ where: { id: choreId }, data: { researchStatus: "pending", researchError: null } });
  void runResearch(choreId)
    .catch(async (e) => {
      console.error("purchase research failed", choreId, e);
      await prisma.chore
        .update({ where: { id: choreId }, data: { researchStatus: "error", researchError: describeError(e) } })
        .catch(() => {});
    })
    .finally(() => inflight.delete(choreId));
}

function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Invalid ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "Anthropic rate limit hit — try again in a minute.";
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ""}: ${e.message}`.slice(0, 500);
  return ((e as Error)?.message ?? String(e)).slice(0, 500);
}

function buildSystem(rules: string): string {
  return `You are the purchase research assistant of a family household app. Given a purchase request, research the web and recommend specific products the family can order right now.

Purchase rules — apply them automatically and strictly, without being asked:
${rules}

How to work:
- Use web_search to find candidates and web_fetch to open product and brand pages, so prices, availability, delivery to Belgium and country of manufacture are checked on the actual page whenever possible.
- Cover the whole need: if it takes several items (e.g. a liner plus a blanket), propose complete combinations.
- Only include links you actually found; never invent URLs. If a shop blocked you or something could not be verified, say so on that item.

Output: plain text only, no markdown (no #, no **, no tables). Write in the same language as the request. Structure:
One or two lines with your recommendation first.
Then 3 to 6 numbered options, each formatted as:
1. Product name — price in EUR — shop
   Made in: country (where you verified it)
   Delivery to Belgium: estimate
   Why: one short sentence
   https://direct-link-to-the-product
End with a short "Notes:" line for caveats (unverified items, rules that could not be met).`;
}

function buildUserPrompt(chore: { title: string; purchaseDescription: string | null; notes: string | null; dueDate: Date | null }): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `Today is ${today}.`,
    `Purchase: ${chore.title}`,
    chore.purchaseDescription ? `What we are looking for: ${chore.purchaseDescription}` : null,
    chore.notes ? `Extra notes: ${chore.notes}` : null,
    chore.dueDate ? `Needed by: ${chore.dueDate.toISOString().slice(0, 10)} — prefer options that can arrive in time.` : null
  ];
  return lines.filter(Boolean).join("\n");
}

async function runResearch(choreId: string): Promise<void> {
  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  if (!chore || !chore.householdId) throw new Error("Chore not found");
  await prisma.chore.update({ where: { id: choreId }, data: { researchStatus: "running" } });

  const rules = await getPurchaseRules(chore.householdId);
  const client = new Anthropic();
  const userPrompt = buildUserPrompt(chore);
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 20,
      user_location: { type: "approximate", country: "BE", timezone: "Europe/Brussels" }
    },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 25 }
  ];

  let messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userPrompt }];
  let final: Anthropic.Beta.BetaMessage | null = null;

  for (let i = 0; i < MAX_CONTINUATIONS; i++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: buildSystem(rules),
      tools,
      messages
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "pause_turn") {
      // Server-side tool loop hit its iteration cap: resend so it resumes.
      messages = [
        { role: "user", content: userPrompt },
        { role: "assistant", content: msg.content }
      ];
      continue;
    }
    final = msg;
    break;
  }

  if (!final) throw new Error("Research did not finish (too many continuations).");
  if (final.stop_reason === "refusal") throw new Error("The model declined this request.");

  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("Research returned no text.");

  const truncated = final.stop_reason === "max_tokens" ? "\n\n(Output was cut short.)" : "";
  await prisma.chore.update({
    where: { id: choreId },
    data: {
      researchStatus: "done",
      researchResult: text + truncated,
      researchError: null,
      researchedAt: new Date()
    }
  });
  void sendToHousehold(chore.householdId, {
    title: "🛒 Suggestions ready",
    body: chore.title,
    url: "/",
    tag: `purchase-research-${choreId}`
  }).catch(() => {});
}
