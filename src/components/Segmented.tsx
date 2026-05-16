"use client";

export type SegmentedOption<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md"
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  size?: "md" | "lg";
}) {
  return (
    <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.05)", borderRadius: 99, padding: 4 }}>
      {options.map((opt) => {
        const sel = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            type="button"
            style={{
              padding: size === "lg" ? "10px 18px" : "7px 14px",
              borderRadius: 99,
              background: sel ? "var(--surface)" : "transparent",
              color: sel ? "var(--ink)" : "var(--ink-3)",
              fontWeight: 700,
              fontSize: size === "lg" ? 15 : 13,
              boxShadow: sel ? "var(--shadow-sm)" : "none",
              transition: "all 0.15s"
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
