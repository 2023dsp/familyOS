export type AssigneeSlug = "davide" | "luize" | "both" | "unassigned";

export const ASSIGNEES: Record<AssigneeSlug, { id: AssigneeSlug; name: string; initials: string }> = {
  davide: { id: "davide", name: "Davide", initials: "D" },
  luize: { id: "luize", name: "Luize", initials: "L" },
  both: { id: "both", name: "Both", initials: "D+L" },
  unassigned: { id: "unassigned", name: "Anyone", initials: "?" }
};

export type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
  soft: string;
};

export const CATEGORIES: Category[] = [
  { id: "cleaning", label: "Cleaning", icon: "broom", color: "var(--terracotta)", soft: "var(--terracotta-soft)" },
  { id: "kitchen", label: "Kitchen", icon: "dishes", color: "var(--olive)", soft: "var(--olive-soft)" },
  { id: "errands", label: "Errands", icon: "cart", color: "var(--sand)", soft: "var(--sand-soft)" },
  { id: "home", label: "Home & Care", icon: "sofa", color: "var(--blue)", soft: "var(--blue-soft)" },
  { id: "garden", label: "Garden", icon: "plant", color: "var(--olive)", soft: "var(--olive-soft)" },
  { id: "vehicle", label: "Vehicle", icon: "car", color: "var(--ink-2)", soft: "var(--surface-3)" },
  { id: "bills", label: "Admin & Bills", icon: "card", color: "var(--rose)", soft: "var(--rose-soft)" },
  { id: "appointments", label: "Appointments", icon: "book", color: "var(--terracotta-deep)", soft: "var(--terracotta-soft)" }
];

export const PRIORITIES = {
  low: { label: "Low", color: "var(--ink-3)", bg: "rgba(0,0,0,0.05)", dots: 1 },
  medium: { label: "Medium", color: "var(--sand)", bg: "var(--sand-soft)", dots: 2 },
  high: { label: "High", color: "var(--terracotta-deep)", bg: "var(--terracotta-soft)", dots: 3 }
} as const;

export type PriorityKey = keyof typeof PRIORITIES;

export const ICON_NAMES = [
  "broom",
  "trash",
  "plant",
  "drop",
  "bulb",
  "car",
  "sofa",
  "card",
  "dishes",
  "cart",
  "book",
  "tools",
  "home",
  "calendar",
  "layers",
  "settings",
  "users",
  "user",
  "link",
  "plus",
  "check",
  "sun",
  "moon",
  "fire",
  "trophy",
  "sparkles",
  "refresh",
  "clock",
  "close",
  "chevron",
  "back",
  "forward",
  "archive",
  "mic"
] as const;

export type IconName = (typeof ICON_NAMES)[number];
