import { RuleSuggestionProvider, type Suggestion, type SuggestionProvider } from "./suggest";

const SYSTEM = `You normalize free-form chore titles into a structured suggestion for a household to-do app.
Return ONLY a compact JSON object with these optional fields:
  cleanTitle (string, cleaned-up imperative form),
  icon (one of: broom,dishes,trash,plant,drop,bulb,cart,car,sofa,card,book,tools),
  category (one of: cleaning,kitchen,errands,home,garden,vehicle,bills,appointments),
  priority ("low"|"medium"|"high"),
  recurInterval (positive integer),
  recurUnit ("day"|"week"|"month"),
  dueHint ("today"|"tomorrow"|"this-week"|"weekend").
Omit any field you cannot infer with high confidence. Input may be Italian or English.
No prose. JSON only.`;

const ICONS = new Set(["broom", "dishes", "trash", "plant", "drop", "bulb", "cart", "car", "sofa", "card", "book", "tools"]);
const CATS = new Set(["cleaning", "kitchen", "errands", "home", "garden", "vehicle", "bills", "appointments"]);
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
