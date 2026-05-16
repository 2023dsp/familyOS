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

// Fallback categories — used if the API hasn't returned yet. Real categories
// live in the DB and are managed via the Settings screen. The shape matches
// what /api/categories returns (id = slug).
export const CATEGORIES: Category[] = [
  { id: "cleaning", label: "Cleaning", icon: "broom", color: "#C97B5B", soft: "#E8C2AC" },
  { id: "kitchen", label: "Kitchen", icon: "dishes", color: "#3F4B3B", soft: "#B5C2A6" },
  { id: "errands", label: "Errands", icon: "cart", color: "#D9B36C", soft: "#F0DEB3" },
  { id: "home", label: "Home & Care", icon: "sofa", color: "#6F8AA8", soft: "#C5D2DF" },
  { id: "garden", label: "Garden", icon: "plant", color: "#3F4B3B", soft: "#B5C2A6" },
  { id: "vehicle", label: "Vehicle", icon: "car", color: "#5C4F3F", soft: "#DFD0B4" },
  { id: "bills", label: "Admin & Bills", icon: "card", color: "#D89AA0", soft: "#F1D6D9" },
  { id: "appointments", label: "Appointments", icon: "book", color: "#A85F40", soft: "#E8C2AC" }
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
