"use client";

import { useState } from "react";

// Strip variation selector (U+FE0F) — OpenMoji + Twemoji filenames omit it.
function toCodePoint(emoji: string): string {
  const codes: string[] = [];
  let prev = 0;
  for (let i = 0; i < emoji.length; ) {
    const c = emoji.charCodeAt(i++);
    if (prev) {
      codes.push((0x10000 + ((prev - 0xd800) << 10) + (c - 0xdc00)).toString(16).toUpperCase());
      prev = 0;
      continue;
    }
    if (c >= 0xd800 && c <= 0xdbff) {
      prev = c;
      continue;
    }
    if (c === 0xfe0f) continue;
    codes.push(c.toString(16).toUpperCase());
  }
  return codes.join("-");
}

/**
 * Renders a cartoon-style emoji via OpenMoji's color SVG set
 * (https://openmoji.org, CC BY-SA 4.0). Falls back to the native OS emoji
 * if the network fetch fails — so kids never see a broken-image icon.
 */
export function KidEmoji({ emoji, size = 80, label }: { emoji: string; size?: number; label?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-label={label}
        role="img"
        style={{ fontSize: size * 0.9, lineHeight: 1, display: "block", transform: "translateY(2px)" }}
      >
        {emoji}
      </span>
    );
  }
  const code = toCodePoint(emoji);
  const src = `https://cdn.jsdelivr.net/npm/openmoji@15.0.0/color/svg/${code}.svg`;
  return (
    <img
      src={src}
      alt={label ?? emoji}
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
      style={{ display: "block", userSelect: "none", pointerEvents: "none" }}
    />
  );
}
