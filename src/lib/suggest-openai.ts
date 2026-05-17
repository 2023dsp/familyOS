import { RuleSuggestionProvider, type Suggestion, type SuggestionProvider } from "./suggest";

// Each icon has a short semantic description so the model knows what it represents,
// not just the slug. Keeping this list in lockstep with src/components/Icon.tsx.
const ICON_CATALOG: Array<{ name: string; desc: string }> = [
  { name: "broom", desc: "sweeping floors, dusting, generic cleaning" },
  { name: "vacuum", desc: "vacuuming carpets, rugs, hoovering" },
  { name: "dishes", desc: "washing dishes, plates, dishwasher" },
  { name: "trash", desc: "taking out garbage, recycling, bins" },
  { name: "laundry", desc: "laundry basket, washing clothes" },
  { name: "washing", desc: "washing machine, doing wash cycle" },
  { name: "iron", desc: "ironing clothes" },
  { name: "shirt", desc: "getting dressed, folding shirts, clothes" },
  { name: "plant", desc: "watering plants, gardening, houseplants" },
  { name: "flower", desc: "flowers, bouquet, blooms, deadheading" },
  { name: "drop", desc: "water, watering, plumbing, leaks" },
  { name: "bulb", desc: "lightbulbs, electrical, ideas, lamps" },
  { name: "cart", desc: "grocery shopping, supermarket" },
  { name: "package", desc: "packages, deliveries, parcels, mail pickup" },
  { name: "car", desc: "car maintenance, driving, vehicle, gas" },
  { name: "sofa", desc: "living room, tidying, furniture" },
  { name: "card", desc: "bills, payments, credit cards, banking" },
  { name: "book", desc: "reading, study, homework, library" },
  { name: "tools", desc: "fixing, DIY, repairs, maintenance" },
  { name: "window", desc: "cleaning windows, mirrors" },
  { name: "teeth", desc: "brushing teeth, dental hygiene" },
  { name: "shower", desc: "showering, bathing" },
  { name: "bath", desc: "bathtub, soaking, bath time for kids" },
  { name: "hands", desc: "washing hands, hygiene" },
  { name: "bed", desc: "making bed, bedtime, bedroom" },
  { name: "breakfast", desc: "breakfast, eggs, morning meal" },
  { name: "fork", desc: "eating meal, dinner, lunch, cooking" },
  { name: "cup", desc: "drinking water, coffee, tea, hydration" },
  { name: "table", desc: "setting the table, dining" },
  { name: "pet", desc: "pet care, dog, cat, feeding animal" },
  { name: "paw", desc: "walking dog, pet walks, animals" },
  { name: "toys", desc: "tidying toys, kids playthings" },
  { name: "backpack", desc: "school bag, packing for school" },
  { name: "pill", desc: "medicine, vitamins, prescriptions" },
  { name: "bottle", desc: "baby bottle, drinks, beverages" }
];

const ICON_LIST = ICON_CATALOG.map((i) => `${i.name}=${i.desc}`).join("; ");

const SYSTEM = `You normalize free-form chore titles into a structured suggestion for a household to-do app.
Return ONLY a compact JSON object with these optional fields:
  cleanTitle (string, cleaned-up imperative form),
  icon (pick the SINGLE most semantically appropriate icon by meaning, NOT by name similarity — read the descriptions carefully),
  category (one of: cleaning,kitchen,errands,home,garden,vehicle,bills,appointments,kids,health),
  priority ("low"|"medium"|"high"),
  recurInterval (positive integer),
  recurUnit ("day"|"week"|"month"),
  dueHint ("today"|"tomorrow"|"this-week"|"weekend").

ICON OPTIONS (slug=meaning):
${ICON_LIST}

Rules for icon selection:
- Choose the icon whose MEANING best matches the chore, even if its name is different from the chore word.
- For tasks like "iron clothes" pick "iron", "wash car" pick "car", "shower" pick "shower" (not "drop").
- For ambiguous cases default to the more specific over the generic.
- If genuinely unclear, omit the icon field entirely.

Omit any field you cannot infer with high confidence. Input may be Italian or English. Translate Italian chore titles to recognize them.
No prose. JSON only.`;

const ICONS = new Set(ICON_CATALOG.map((i) => i.name));
const CATS = new Set(["cleaning", "kitchen", "errands", "home", "garden", "vehicle", "bills", "appointments", "kids", "health"]);
const PRIOS = new Set(["low", "medium", "high"]);
const UNITS = new Set(["day", "week", "month"]);
const DUES = new Set(["today", "tomorrow", "this-week", "weekend"]);

function coerce(raw: Record<string, unknown>): Suggestion {
  const out: Suggestion = {};
  if (typeof raw.cleanTitle === "string" && raw.cleanTitle.length > 0) out.cleanTitle = raw.cleanTitle;
  if (typeof raw.icon === "string" && ICONS.has(raw.icon)) out.icon = raw.icon;
  if (typeof raw.category === "string" && CATS.has(raw.category)) out.category = raw.category;
  if (typeof raw.priority === "string" && PRIOS.has(raw.priority)) out.priority = raw.priority as Suggestion["priority"];
  if (typeof raw.recurInterval === "number" && raw.recurInterval > 0 && raw.recurInterval < 366) {
    out.recurInterval = Math.floor(raw.recurInterval);
  }
  if (typeof raw.recurUnit === "string" && UNITS.has(raw.recurUnit)) out.recurUnit = raw.recurUnit as Suggestion["recurUnit"];
  if (typeof raw.dueHint === "string" && DUES.has(raw.dueHint)) out.dueHint = raw.dueHint as Suggestion["dueHint"];
  return out;
}

export class OpenAISuggestionProvider implements SuggestionProvider {
  private fallback = new RuleSuggestionProvider();
  private apiKey = process.env.OPENAI_API_KEY ?? "";
  private model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  private timeoutMs = 4000;

  async suggest(title: string): Promise<Suggestion> {
    const ruleSuggestion = this.fallback.suggest(title);
    if (!title || title.trim().length < 3 || !this.apiKey) return ruleSuggestion;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: title }
          ],
          response_format: { type: "json_object" }
        })
      });
      if (!res.ok) return ruleSuggestion;
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content);
      const ai = coerce(parsed);
      // Merge: AI wins on overlap, rule fills the gaps.
      return { ...ruleSuggestion, ...ai };
    } catch {
      return ruleSuggestion;
    } finally {
      clearTimeout(t);
    }
  }
}
