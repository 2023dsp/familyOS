const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - diff);
  return x;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 7);
  s.setMilliseconds(s.getMilliseconds() - 1);
  return s;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function humanDue(due: Date | null | undefined): string {
  if (!due) return "";
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(due));
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1 && diff <= 6) return WEEKDAYS[target.getDay()] ?? "";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function helloFor(d: Date = new Date()): { greeting: string; emoji: "sun" | "moon"; tod: "morning" | "midday" | "evening" | "night" } {
  const h = d.getHours();
  if (h < 5) return { greeting: "Good night", emoji: "moon", tod: "night" };
  if (h < 12) return { greeting: "Good morning", emoji: "sun", tod: "morning" };
  if (h < 17) return { greeting: "Good afternoon", emoji: "sun", tod: "midday" };
  if (h < 21) return { greeting: "Good evening", emoji: "moon", tod: "evening" };
  return { greeting: "Good night", emoji: "moon", tod: "night" };
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
