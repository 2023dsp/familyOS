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
  // Kids hygiene + routine
  [/\b(brush\s*teeth|denti|spazzolino|dental)\b/i, { icon: "teeth", category: "kids" }],
  [/\b(wash\s*hands|lavarsi\s*le\s*mani|lava\s*le\s*mani)\b/i, { icon: "hands", category: "kids" }],
  [/\b(shower|doccia)\b/i, { icon: "shower", category: "home" }],
  [/\b(bath|bagnetto|vasca)\b/i, { icon: "bath", category: "kids" }],
  [/\b(make\s*bed|rifare\s*il\s*letto|bedtime|nanna|sleep)\b/i, { icon: "bed", category: "kids" }],
  [/\b(get\s*dressed|vestirsi|vestiti)\b/i, { icon: "shirt", category: "kids" }],
  [/\b(toys?|giocattol\w*|tidy\s*toys)\b/i, { icon: "toys", category: "kids" }],
  [/\b(school\s*bag|backpack|zaino|cartella)\b/i, { icon: "backpack", category: "kids" }],
  // Pets
  [/\b(walk\s*(the\s*)?dog|portar\w*\s*fuori\s*il\s*cane|cammin\w*\s*cane)\b/i, { icon: "paw", category: "home" }],
  [/\b(feed\s*(the\s*)?(cat|dog|pet)|gatto|cane|pesc\w*|animal\w*)\b/i, { icon: "pet", category: "home" }],
  // Kitchen
  [/\b(breakfast|colazione)\b/i, { icon: "breakfast", category: "kitchen" }],
  [/\b(lunch|dinner|cena|pranzo|cook|cucina\w*|cooking)\b/i, { icon: "fork", category: "kitchen" }],
  [/\b(set\s*the\s*table|apparecchiar\w*)\b/i, { icon: "table", category: "kitchen" }],
  [/\b(piatti|dishes|dishwasher|lavastovigli\w*)\b/i, { icon: "dishes", category: "kitchen" }],
  [/\b(water|drink|acqua|bere|hydrat\w*)\b/i, { icon: "cup", category: "health" }],
  // Laundry
  [/\b(lavatrice|laundry|wash\s*clothes)\b/i, { icon: "washing", category: "cleaning" }],
  [/\b(stir\w*|stenc\w*|piegar\w*|fold|laundry\s*basket)\b/i, { icon: "laundry", category: "cleaning" }],
  [/\b(iron|stir\w*\b)/i, { icon: "iron", category: "cleaning" }],
  // House cleaning
  [/\b(window\w*|finestr\w*|specchi\w*)\b/i, { icon: "window", category: "cleaning" }],
  [/\b(aspirapolvere|vacuum|hoover)\b/i, { icon: "vacuum", category: "cleaning" }],
  [/\b(spazza\w*|trash|garbage|rifiuti|recyc\w*)\b/i, { icon: "trash", category: "cleaning" }],
  [/\b(divano|sofa|couch|living\s*room|salott\w*)\b/i, { icon: "sofa", category: "home" }],
  [/\b(pulire|clean|cleaning|pul\w*|bagno|bathroom|toilet)\b/i, { icon: "broom", category: "cleaning" }],
  // Garden
  [/\b(piante|plant|plants|foglie|leaves|piantin\w*)\b/i, { icon: "plant", category: "garden" }],
  [/\b(flower\w*|fior\w*)\b/i, { icon: "flower", category: "garden" }],
  [/\b(giardino|garden|prato|orto)\b/i, { icon: "plant", category: "garden" }],
  [/\b(annaffia\w*|water\s*(the\s*)?plant|innaffi\w*)\b/i, { icon: "drop", category: "garden" }],
  // Errands
  [/\b(spesa|grocery|groceries|shop|shopping)\b/i, { icon: "cart", category: "errands" }],
  [/\b(pacc\w*|package|deliver\w*|consegn\w*|posta|mail)\b/i, { icon: "package", category: "errands" }],
  // Vehicle
  [/\b(gomme|pneumati\w*|tires?)\b/i, { icon: "car", category: "vehicle", recurInterval: 6, recurUnit: "month" }],
  [/\b(auto|car|veicolo|vehicle|wash\s*car)\b/i, { icon: "car", category: "vehicle" }],
  // Bills + appointments
  [/\b(bolletta|fattur\w*|bill|payment|invoice)\b/i, { icon: "card", category: "bills", priority: "high", recurInterval: 1, recurUnit: "month" }],
  [/\b(pagar\w*|pay)\b/i, { icon: "card", category: "bills", priority: "high" }],
  [/\b(dentista|dentist|doctor|medic\w*|appuntamento|appointment)\b/i, { icon: "book", category: "appointments" }],
  [/\b(prenotar\w*|book\b)/i, { icon: "book", category: "appointments" }],
  // Health
  [/\b(pill|medic\w*|vitamin|farmac\w*|pastigli\w*)\b/i, { icon: "pill", category: "health" }],
  [/\b(bottle|biberon|borraccia)\b/i, { icon: "bottle", category: "kids" }],
  [/\b(book\b|read|libro|leggere|study|studio)\b/i, { icon: "book", category: "kids" }],
  // Home maintenance
  [/\b(lampadin\w*|light\s*bulb|bulb)\b/i, { icon: "bulb", category: "errands" }],
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

async function pickProvider(): Promise<SuggestionProvider> {
  if (process.env.OPENAI_API_KEY) {
    const mod = await import("./suggest-openai");
    return new mod.OpenAISuggestionProvider();
  }
  return new RuleSuggestionProvider();
}

export const defaultSuggestionProvider: SuggestionProvider = {
  async suggest(title: string) {
    const p = await pickProvider();
    return p.suggest(title);
  }
};
