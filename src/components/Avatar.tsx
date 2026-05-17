"use client";

import { useMemberBySlug } from "./FamilyMembersContext";

export function Avatar({
  who,
  size = 32,
  fallbackColor
}: {
  who?: string | null;
  size?: number;
  fallbackColor?: string;
}) {
  const member = useMemberBySlug(who ?? undefined);

  if (!member) {
    // Unknown / unassigned slug: dashed circle with "?".
    const isUnassigned = !who || who === "unassigned";
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: isUnassigned ? "transparent" : fallbackColor ?? "var(--ink-3)",
          color: isUnassigned ? "var(--ink-3)" : "white",
          border: isUnassigned ? "1.5px dashed var(--line-2)" : "none",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: size * 0.36,
          flexShrink: 0
        }}
      >
        {isUnassigned ? "?" : who?.charAt(0).toUpperCase() ?? "?"}
      </span>
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: member.color,
        color: "white",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: size * 0.36,
        flexShrink: 0
      }}
    >
      {member.initials}
    </span>
  );
}
