export function Ring({
  value,
  max = 1,
  size = 64,
  stroke = 6,
  color = "var(--terracotta)",
  label
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={C}
          strokeDashoffset={C - C * pct}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: size * 0.28,
          color: "var(--ink)"
        }}
      >
        {label ?? `${Math.round(pct * 100)}%`}
      </div>
    </div>
  );
}

export function Progress({ value, max = 1, color = "var(--olive)", height = 8 }: { value: number; max?: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  return (
    <div style={{ width: "100%", height, borderRadius: 99, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          transition: "width 0.4s cubic-bezier(0.2, 0.7, 0.2, 1)"
        }}
      />
    </div>
  );
}
