import * as React from "react";

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
};

type Path = (c: string, a: string) => React.ReactNode;

const PATHS: Record<string, Path> = {
  broom: (c, a) => (
    <g>
      <path d="M14 4l-7 7c-.6.6-.6 1.6 0 2.2l3.8 3.8c.6.6 1.6.6 2.2 0l7-7L14 4z" fill={c} opacity="0.35" />
      <path d="M4 20l5-5 1 1-5 5z" fill={a} />
      <circle cx="18" cy="6" r="2" fill={c} />
    </g>
  ),
  trash: (c, a) => (
    <g>
      <path d="M5 7h14l-1.3 12.2A2 2 0 0 1 15.7 21H8.3a2 2 0 0 1-2-1.8L5 7z" fill={c} opacity="0.35" />
      <rect x="3" y="5" width="18" height="3" rx="1.5" fill={c} />
      <path d="M9 4h6v2H9z" fill={a} />
      <path d="M10 11v6M14 11v6" stroke={a} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  plant: (c, a) => (
    <g>
      <path d="M12 12c0-4 2-7 7-8-1 5-3 8-7 8z" fill={c} />
      <path d="M12 14c0-3-2-6-7-6 1 4 3 6 7 6z" fill={c} opacity="0.4" />
      <path d="M9 13h6l-1 7H10l-1-7z" fill={a} />
    </g>
  ),
  drop: (c, a) => (
    <g>
      <path d="M12 3c3 5 6 8 6 11a6 6 0 1 1-12 0c0-3 3-6 6-11z" fill={c} opacity="0.35" />
      <path d="M9 14a3 3 0 0 0 3 3" stroke={a} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  bulb: (c, a) => (
    <g>
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V17h5.4v-1.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" fill={c} opacity="0.35" />
      <path d="M12 6v6M9.5 11h5" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="9" y="18" width="6" height="2" rx="1" fill={a} />
      <path d="M10 21h4" stroke={a} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  car: (c, a) => (
    <g>
      <path d="M5 11l1.5-4a2 2 0 0 1 1.9-1.4h7.2A2 2 0 0 1 17.5 7L19 11l1 1v4a1 1 0 0 1-1 1h-1.5a2 2 0 0 1-4 0H10a2 2 0 0 1-4 0H4.5a1 1 0 0 1-1-1v-4l1-1z" fill={c} opacity="0.35" />
      <circle cx="7.5" cy="16" r="1.7" fill={a} />
      <circle cx="16.5" cy="16" r="1.7" fill={a} />
    </g>
  ),
  sofa: (c, a) => (
    <g>
      <path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4v-3z" fill={c} opacity="0.4" />
      <rect x="3" y="13" width="18" height="5" rx="2" fill={c} />
      <rect x="6" y="8" width="5" height="3" rx="1" fill={a} />
      <rect x="13" y="8" width="5" height="3" rx="1" fill={a} />
    </g>
  ),
  card: (c, a) => (
    <g>
      <rect x="3" y="6" width="18" height="13" rx="2.5" fill={c} opacity="0.35" />
      <rect x="3" y="9" width="18" height="3" fill={c} />
      <rect x="6" y="14" width="6" height="2" rx="0.8" fill={a} />
    </g>
  ),
  dishes: (c, a) => (
    <g>
      <circle cx="12" cy="12" r="8" fill={c} opacity="0.35" />
      <circle cx="12" cy="12" r="3.5" fill={a} />
    </g>
  ),
  cart: (c, a) => (
    <g>
      <path d="M3 4h2l2 12h11l2-8H7" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1.6" fill={a} />
      <circle cx="17" cy="20" r="1.6" fill={a} />
    </g>
  ),
  book: (c, a) => (
    <g>
      <path d="M5 4h9a3 3 0 0 1 3 3v14H7a2 2 0 0 1-2-2V4z" fill={c} opacity="0.35" />
      <path d="M8 8h6M8 12h6" stroke={a} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  tools: (c, a) => (
    <g>
      <path d="M14 4a4 4 0 0 1 4 4l-3 3 2 2 4-4a6 6 0 0 1-7 7L4 20l-1-1 7-10a6 6 0 0 1 4-5z" fill={c} opacity="0.35" />
      <circle cx="14.5" cy="6.5" r="1.5" fill={a} />
    </g>
  ),
  home: (c, a) => (
    <g>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill={c} opacity="0.35" />
      <path d="M3 11l9-7 9 7" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  calendar: (c, a) => (
    <g>
      <rect x="3" y="5" width="18" height="16" rx="3" fill={c} opacity="0.35" />
      <rect x="3" y="5" width="18" height="5" rx="3" fill={c} />
      <path d="M8 3v4M16 3v4" stroke={a} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1" fill={a} />
      <circle cx="13" cy="14" r="1" fill={a} />
      <circle cx="17" cy="14" r="1" fill={a} />
    </g>
  ),
  layers: (c, a) => (
    <g>
      <path d="M12 3l9 5-9 5-9-5 9-5z" fill={c} opacity="0.5" />
      <path d="M3 13l9 5 9-5" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M3 17l9 5 9-5" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  settings: (c, a) => (
    <g>
      <circle cx="12" cy="12" r="3" fill={c} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke={a} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  users: (c, a) => (
    <g>
      <circle cx="9" cy="9" r="3.5" fill={c} opacity="0.5" />
      <circle cx="17" cy="10" r="2.5" fill={c} opacity="0.35" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M14 20c0-2 2-3 4-3s4 1 4 3" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  user: (c, a) => (
    <g>
      <circle cx="12" cy="9" r="4" fill={c} opacity="0.5" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  link: (c, a) => (
    <g>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" stroke={c} strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" stroke={a} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </g>
  ),
  plus: (c) => (
    <g>
      <path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  check: (c) => (
    <g>
      <path d="M5 12l4 4 10-10" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  sun: (c, a) => (
    <g>
      <circle cx="12" cy="12" r="4" fill={c} />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  ),
  moon: (c) => (
    <g>
      <path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z" fill={c} opacity="0.6" />
    </g>
  ),
  fire: (c, a) => (
    <g>
      <path d="M12 3c-1 4-4 5-4 9a4 4 0 1 0 8 0c0-3-3-5-4-9z" fill={c} opacity="0.45" />
      <path d="M11 14c0 1 0.5 2 1 2s1-1 1-2-0.5-1.5-1-2-1 1-1 2z" fill={a} />
    </g>
  ),
  trophy: (c, a) => (
    <g>
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" fill={c} opacity="0.45" />
      <path d="M9 15h6v3a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-3z" fill={a} />
      <path d="M5 6h2v2a3 3 0 0 0 3 3M19 6h-2v2a3 3 0 0 1-3 3" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  sparkles: (c, a) => (
    <g>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" fill={c} />
      <path d="M19 15l0.7 1.7L21.5 17l-1.8 0.6L19 19l-0.7-1.4-1.8-0.6 1.8-0.3z" fill={a} />
    </g>
  ),
  refresh: (c) => (
    <g>
      <path d="M4 12a8 8 0 0 1 14-5l2-1v5h-5l2-2a5 5 0 0 0-9 3M20 12a8 8 0 0 1-14 5l-2 1v-5h5l-2 2a5 5 0 0 0 9-3" stroke={c} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  clock: (c, a) => (
    <g>
      <circle cx="12" cy="12" r="9" fill={c} opacity="0.25" />
      <path d="M12 7v5l3 2" stroke={a} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  ),
  close: (c) => (
    <g>
      <path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  chevron: (c) => (
    <g>
      <path d="M9 5l7 7-7 7" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  back: (c) => (
    <g>
      <path d="M15 5l-7 7 7 7" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  forward: (c) => (
    <g>
      <path d="M9 5l7 7-7 7" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  archive: (c, a) => (
    <g>
      <rect x="3" y="4" width="18" height="4" rx="1.5" fill={c} opacity="0.45" />
      <rect x="4" y="8" width="16" height="12" rx="2" fill={c} opacity="0.25" />
      <path d="M10 12h4" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  ),
  star: (c, a) => (
    <g>
      <path d="M12 3l2.6 5.4L20.5 9l-4.3 4 1 6L12 16.3 6.8 19l1-6L3.5 9l5.9-.6L12 3z" fill={c}/>
      <path d="M12 5.5l1.8 3.7 4 .4-3 2.8.7 4L12 14.4l-3.5 1.9.7-4-3-2.8 4-.4L12 5.5z" fill={a} opacity="0.5"/>
    </g>
  ),
  mic: (c, a) => (
    <g>
      <rect x="9" y="3" width="6" height="12" rx="3" fill={c} opacity="0.4" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  )
};

export function Icon({ name, size = 24, color = "var(--terracotta)", accent, className }: IconProps) {
  const a = accent ?? color;
  const render = PATHS[name];
  if (!render) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="4" fill={color} opacity="0.3" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {render(color, a)}
    </svg>
  );
}
