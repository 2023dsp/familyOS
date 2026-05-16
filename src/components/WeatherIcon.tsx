import * as React from "react";

type Props = {
  code: number;
  size?: number;
  isNight?: boolean;
};

const SUN = "#E8B04A";
const SUN_SOFT = "#F0C97A";
const CLOUD = "#C7BFAE";
const CLOUD_DARK = "#8E8472";
const RAIN = "#6F8AA8";
const SNOW = "#C5D2DF";
const LIGHTNING = "#D88A3A";
const MOON = "#C7B89E";
const FOG = "#B5A589";

function Sun({ size = 32, soft = false }: { size?: number; soft?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="7" fill={soft ? SUN_SOFT : SUN} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 16 + Math.cos(a) * 11;
        const y1 = 16 + Math.sin(a) * 11;
        const x2 = 16 + Math.cos(a) * 14;
        const y2 = 16 + Math.sin(a) * 14;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SUN} strokeWidth={2} strokeLinecap="round" />;
      })}
    </svg>
  );
}

function Moon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M22 20a8 8 0 1 1-10-10 7 7 0 0 0 10 10z" fill={MOON} />
    </svg>
  );
}

function Cloud({ x = 6, y = 14, w = 20, fill = CLOUD, size = 32 }: { x?: number; y?: number; w?: number; fill?: string; size?: number }) {
  const h = (w * 12) / 20;
  return (
    <g>
      <ellipse cx={x + w * 0.3} cy={y + h * 0.55} rx={w * 0.32} ry={h * 0.45} fill={fill} />
      <ellipse cx={x + w * 0.6} cy={y + h * 0.4} rx={w * 0.38} ry={h * 0.55} fill={fill} />
      <ellipse cx={x + w * 0.82} cy={y + h * 0.62} rx={w * 0.24} ry={h * 0.4} fill={fill} />
      <rect x={x + 1} y={y + h * 0.55} width={w - 2} height={h * 0.45} rx={h * 0.22} fill={fill} />
      <line x1={size} y1={size} x2={size} y2={size} />
    </g>
  );
}

function CloudOnly({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <Cloud x={4} y={10} w={24} fill={CLOUD} size={size} />
    </svg>
  );
}

function SunCloud({ size = 32, partial = false }: { size?: number; partial?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="11" cy="11" r="5" fill={SUN} />
      {!partial && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 11 + Math.cos(a) * 7;
        const y1 = 11 + Math.sin(a) * 7;
        const x2 = 11 + Math.cos(a) * 9;
        const y2 = 11 + Math.sin(a) * 9;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SUN} strokeWidth={1.6} strokeLinecap="round" />;
      })}
      <Cloud x={8} y={15} w={20} fill={CLOUD} size={size} />
    </svg>
  );
}

function MoonCloud({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 8a5 5 0 1 0 5 5 4.5 4.5 0 0 1-5-5z" fill={MOON} />
      <Cloud x={8} y={15} w={20} fill={CLOUD} size={size} />
    </svg>
  );
}

function Rain({ size = 32, heavy = false }: { size?: number; heavy?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <Cloud x={4} y={6} w={24} fill={heavy ? CLOUD_DARK : CLOUD} size={size} />
      {[8, 14, 20, 24].slice(0, heavy ? 4 : 3).map((x, i) => (
        <line key={i} x1={x} y1={20} x2={x - 2} y2={26} stroke={RAIN} strokeWidth={2} strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Snow({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <Cloud x={4} y={6} w={24} fill={CLOUD} size={size} />
      {[10, 16, 22].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={23} r={1.6} fill={SNOW} />
          <circle cx={x} cy={27} r={1.6} fill={SNOW} />
        </g>
      ))}
    </svg>
  );
}

function Thunder({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <Cloud x={4} y={6} w={24} fill={CLOUD_DARK} size={size} />
      <path d="M16 18l-4 7h3l-2 6 6-9h-3l2-4z" fill={LIGHTNING} />
    </svg>
  );
}

function Fog({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <Cloud x={4} y={4} w={24} fill={CLOUD} size={size} />
      <line x1={4} y1={20} x2={28} y2={20} stroke={FOG} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={6} y1={25} x2={26} y2={25} stroke={FOG} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={9} y1={29} x2={23} y2={29} stroke={FOG} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

export function WeatherIcon({ code, size = 32, isNight = false }: Props) {
  switch (code) {
    case 0:
      return isNight ? <Moon size={size} /> : <Sun size={size} />;
    case 1:
      return isNight ? <MoonCloud size={size} /> : <SunCloud size={size} partial />;
    case 2:
      return isNight ? <MoonCloud size={size} /> : <SunCloud size={size} />;
    case 3:
      return <CloudOnly size={size} />;
    case 45:
    case 48:
      return <Fog size={size} />;
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return <Rain size={size} />;
    case 61:
    case 63:
    case 80:
    case 81:
      return <Rain size={size} />;
    case 65:
    case 82:
      return <Rain size={size} heavy />;
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return <Snow size={size} />;
    case 95:
    case 96:
    case 99:
      return <Thunder size={size} />;
    default:
      return <CloudOnly size={size} />;
  }
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return code === 65 || code === 82 ? "Heavy rain" : "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  if (code === 95 || code === 96 || code === 99) return "Thunder";
  return "—";
}
