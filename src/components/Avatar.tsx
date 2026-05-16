import { ASSIGNEES, type AssigneeSlug } from "../lib/catalog";

export function Avatar({ who = "unassigned", size = 32 }: { who?: AssigneeSlug | string | null; size?: number }) {
  const key = (who as AssigneeSlug) in ASSIGNEES ? (who as AssigneeSlug) : "unassigned";
  const a = ASSIGNEES[key];
  return (
    <span className={`avatar avatar-${key}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {a.initials}
    </span>
  );
}
