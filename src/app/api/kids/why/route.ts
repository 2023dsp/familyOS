import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(120),
  locale: z.string().min(2).max(8).optional()
});

const SYSTEM = `You write VERY short kid-friendly reasons (3-6 words MAX, no period) explaining why a household task matters. The audience is a 4-8 year old. Use upbeat encouraging tone. Output ONLY the reason, no quotes, no extra words.

Examples:
- "Brush teeth" -> "keeps your smile bright"
- "Tidy toys" -> "easier to find favorites"
- "Wash hands" -> "no yucky germs"
- "Pack school bag" -> "ready for adventure"

If the input is in Italian, reply in Italian. If unsure, reply in English.`;

const FALLBACK: Record<string, string> = {
  "brush teeth": "keeps your smile bright",
  "tidy toys": "easier to find favorites",
  "wash hands": "no yucky germs",
  "pack school bag": "ready for adventure",
  "feed the cat": "happy furry friend",
  "make bed": "tidy cozy room",
  "get dressed": "ready for the day",
  "lavarsi i denti": "sorriso forte e bello",
  "riordinare giocattoli": "li ritrovi subito",
  "lavarsi le mani": "via i germi cattivi"
};

function fallback(title: string, locale?: string): string {
  const key = title.trim().toLowerCase();
  const direct = FALLBACK[key];
  if (direct) return direct;
  // partial match
  for (const k of Object.keys(FALLBACK)) {
    if (key.includes(k) || k.includes(key)) return FALLBACK[k];
  }
  return locale?.startsWith("it") ? "è importante per te" : "great for you";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { title, locale } = parsed.data;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ why: fallback(title, locale), source: "fallback" });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 16,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: locale ? `Locale: ${locale}\nTask: ${title}` : title }
        ]
      })
    });
    if (!res.ok) {
      return NextResponse.json({ why: fallback(title, locale), source: "fallback" });
    }
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/\.+$/g, "")
      .split("\n")[0]
      .slice(0, 60);
    if (!cleaned) {
      return NextResponse.json({ why: fallback(title, locale), source: "fallback" });
    }
    return NextResponse.json({ why: cleaned, source: "openai" });
  } catch {
    return NextResponse.json({ why: fallback(title, locale), source: "fallback" });
  } finally {
    clearTimeout(t);
  }
}
