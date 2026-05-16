export type Priority = "low" | "medium" | "high";
export type RecurUnit = "day" | "week" | "month";

export type Suggestion = {
  cleanTitle?: string;
  icon?: string;
  category?: string;
  priority?: Priority;
  recurInterval?: number;
  recurUnit?: RecurUnit;
  dueHint?: "today" | "tomorrow" | "this-week" | "weekend";
};

export interface SuggestionProvider {
  suggest(title: string): Promise<Suggestion> | Suggestion;
}

const KEYWORDS: Array<[RegExp, Partial<Suggestion>]> = [
  [/\b(lampadin\w*|light\s*bulb|bulb)\b/i, { icon: "bulb", category: "errands" }],
  [/\b(gomme|pneumati\w*|tires?)\b/i, { icon: "car", category: "vehicle", recurInterval: 6, recurUnit: "month" }],
  [/\b(auto|car|veicolo|vehicle|wash\s*car)\b/i, { icon: "car", category: "vehicle" }],
  [/\b(giardino|garden|prato)\b/i, { icon: "plant", category: "garden" }],
  [/\b(piante|plant|plants|foglie|leaves)\b/i, { icon: "plant", category: "garden" }],
  [/\b(annaffia\w*|water|innaffi\w*)\b/i, { icon: "drop", category: "garden" }],
  [/\b(bolletta|fattur\w*|bill|payment|invoice)\b/i, { icon: "card", category: "bills", priority: "high", recurInterval: 1, recurUnit: "month" }],
  [/\b(pagar\w*|pay)\b/i, { icon: "card", category: "bills", priority: "high" }],
  [/\b(spesa|grocery|groceries|shop)\b/i, { icon: "cart", category: "errands" }],
  [/\b(divano|sofa|couch)\b/i, { icon: "sofa", category: "home" }],
  [/\b(piatti|dishes|dishwasher|lavastovigli\w*)\b/i, { icon: "dishes", category: "kitchen" }],
  [/\b(spazza\w*|trash|garbage|rifiuti|recyc\w*)\b/i, { icon: "trash", category: "cleaning" }],
  [/\b(aspirapolvere|vacuum|hoover)\b/i, { icon: "broom", category: "cleaning" }],
  [/\b(pulire|clean|cleaning|pul\w*)\b/i, { icon: "broom", category: "cleaning" }],
  [/\b(bagno|bathroom|toilet)\b/i, { icon: "broom", category: "cleaning" }],
  [/\b(lavatrice|lavanderia|laundry|wash)\b/i, { icon: "drop", category: "cleaning" }],
  [/\b(dentista|dentist|doctor|medic\w*|appuntamento|appointment)\b/i, { icon: "book", category: "appointments" }],
  [/\b(prenotar\w*|book\b)/i, { icon: "book", category: "appointments" }],
  [/\b(filtro|filter|hvac|caldai\w*)\b/i, { icon: "tools", category: "home", recurInterval: 3, recurUnit: "month" }]
];

const PRIORITY_HINTS: Array<[RegExp, Priority]> = [
  [/\b(urgent\w*|asap|subito|importante|critic\w*)\b/i, "high"],
  [/\b(quando puoi|sometime|low priority|tranquill\w*)\b/i, "low"]
];

const RECUR_PATTERNS: Array<[RegExp, { interval: number; unit: RecurUnit }]> = [
  [/\bevery\s+(\d+)\s*days?\b/i, { interval: 0, unit: "day" }],
  [/\bevery\s+(\d+)\s*weeks?\b/i, { interval: 0, unit: "week" }],
  [/\bevery\s+(\d+)\s*months?\b/i, { interval: 0, unit: "month" }],
  [/\bogni\s+(\d+)\s*giorn\w*/i, { interval: 0, unit: "day" }],
  [/\bogni\s+(\d+)\s*settiman\w*/i, { interval: 0, unit: "week" }],
  [/\bogni\s+(\d+)\s*mes\w*/i, { interval: 0, unit: "month" }]
];

const DUE_PATTERNS: Array<[RegExp, Suggestion["dueHint"]]> = [
  [/\btoday|oggi\b/i, "today"],
  [/\btomorrow|domani\b/i, "tomorrow"],
  [/\bthis\s+weekend|nel\s+weekend\b/i, "weekend"],
  [/\bthis\s+week|questa\s+settimana\b/i, "this-week"]
];

const STRIP = [
  /\bevery\s+\d+\s*(days?|weeks?|months?)\b/gi,
  /\bogni\s+\d+\s*(giorn\w*|settiman\w*|mes\w*)\b/gi,
  /\b(daily|weekly|monthly|every\s+day|every\s+week|every\s+month|every\s+6\s+months|twice\s+a\s+year)\b/gi,
  /\b(today|tomorrow|this\s+week|this\s+weekend|oggi|domani|questa\s+settimana|nel\s+weekend)\b/gi
];

export class RuleSuggestionProvider implements SuggestionProvider {
  suggest(title: string): Suggestion {
    const out: Suggestion = {};
    if (!title) return out;
    const t = title.toLowerCase();

    for (const [re, base] of KEYWORDS) {
      if (re.test(t)) {
        Object.assign(out, base);
        break;
      }
    }

    for (const [re, p] of PRIORITY_HINTS) {
      if (re.test(t)) {
        out.priority = p;
        break;
      }
    }

    if (/\b(daily|every\s+day|ogni\s+giorno)\b/i.test(t)) {
      out.recurInterval = 1;
      out.recurUnit = "day";
    } else if (/\bweekly|every\s+week|ogni\s+settimana\b/i.test(t)) {
      out.recurInterval = 1;
      out.recurUnit = "week";
    } else if (/\bmonthly|every\s+month|ogni\s+mese\b/i.test(t)) {
      out.recurInterval = 1;
      out.recurUnit = "month";
    } else if (/\bevery\s+6\s+months|twice\s+a\s+year|ogni\s+6\s+mesi\b/i.test(t)) {
      out.recurInterval = 6;
      out.recurUnit = "month";
    } else {
      for (const [re, conf] of RECUR_PATTERNS) {
        const m = t.match(re);
        if (m) {
          out.recurInterval = parseInt(m[1]!, 10) || 1;
          out.recurUnit = conf.unit;
          break;
        }
      }
    }

    for (const [re, hint] of DUE_PATTERNS) {
      if (re.test(t)) {
        out.dueHint = hint;
        break;
      }
    }

    let clean = title;
    for (const re of STRIP) clean = clean.replace(re, " ");
    clean = clean.replace(/\s{2,}/g, " ").trim();
    if (clean.length > 0) {
      out.cleanTitle = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return out;
  }
}

export const defaultSuggestionProvider: SuggestionProvider = new RuleSuggestionProvider();
