// Map our generic icon slug to a kid-friendly emoji. Emojis render as full
// color illustrations on every modern OS — perfect for pre-readers.
const EMOJI: Record<string, string> = {
  // Hygiene / kids routine — prefer "action" emojis where they're clearer than the object alone.
  teeth: "🪥",
  hands: "🧼",
  shower: "🚿",
  bath: "🛁",
  bed: "🛏️",
  shirt: "👕",
  backpack: "🎒",
  toys: "🧸",
  bottle: "🍼",
  // Kitchen
  breakfast: "🥞",
  fork: "🍝",
  cup: "🥛",
  table: "🍽️",
  dishes: "🍽️",
  // Cleaning
  broom: "🧹",
  vacuum: "🧹",
  trash: "🗑️",
  washing: "🧺",
  laundry: "🧺",
  iron: "👔",
  window: "🪟",
  sofa: "🛋️",
  // Plants / nature
  plant: "🌱",
  flower: "🌸",
  drop: "💧",
  // Errands / outside
  cart: "🛒",
  package: "📦",
  car: "🚗",
  // Bills / docs
  card: "💳",
  bulb: "💡",
  tools: "🔧",
  book: "📚",
  // Pets
  pet: "🐶",
  paw: "🐾",
  // Health
  pill: "💊",
  // Misc
  home: "🏠",
  calendar: "📅",
  clock: "⏰",
  star: "⭐"
};

export function emojiForIcon(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return EMOJI[slug] ?? null;
}
