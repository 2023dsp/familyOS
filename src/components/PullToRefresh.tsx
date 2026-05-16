"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

const THRESHOLD = 70;
const MAX_PULL = 120;

export function PullToRefresh({
  onRefresh,
  children,
  className,
  style
}: {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function start(e: TouchEvent) {
      if (!el || el.scrollTop > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
      pulling.current = true;
    }
    function move(e: TouchEvent) {
      if (!pulling.current || startY.current == null || !el) return;
      const y = e.touches[0]?.clientY ?? startY.current;
      const dy = y - startY.current;
      if (dy <= 0 || el.scrollTop > 0) {
        setPull(0);
        return;
      }
      // dampen: easeOut
      const damped = Math.min(MAX_PULL, dy * 0.5);
      setPull(damped);
      if (dy > 5) e.preventDefault();
    }
    async function end() {
      if (!pulling.current) return;
      pulling.current = false;
      startY.current = null;
      if (pull >= THRESHOLD) {
        setRefreshing(true);
        try {
          await onRefresh();
        } catch {
          /* ignore */
        }
        setTimeout(() => setRefreshing(false), 250);
      }
      setPull(0);
    }

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [onRefresh, pull]);

  const indicatorH = refreshing ? 56 : Math.max(0, pull);
  const armed = pull >= THRESHOLD;

  return (
    <div ref={ref} className={className} style={{ ...style, position: "relative", overscrollBehaviorY: "contain" }}>
      <div
        aria-hidden
        style={{
          position: "sticky",
          top: 0,
          marginBottom: -indicatorH,
          height: indicatorH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-3)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.08,
          textTransform: "uppercase",
          transition: refreshing ? "height 0.2s" : "none",
          pointerEvents: "none",
          zIndex: 1
        }}
      >
        {(refreshing || pull > 0) && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: Math.min(1, pull / THRESHOLD + (refreshing ? 1 : 0))
            }}
          >
            <span
              style={{
                display: "inline-block",
                animation: refreshing ? "spin 0.8s linear infinite" : undefined,
                transform: refreshing ? undefined : `rotate(${pull * 2}deg)`,
                transition: refreshing ? undefined : "transform 0.05s linear"
              }}
            >
              <Icon name="refresh" color="var(--terracotta)" size={16} />
            </span>
            {refreshing ? "Refreshing…" : armed ? "Release to refresh" : "Pull to refresh"}
          </span>
        )}
      </div>
      <div
        style={{
          transform: refreshing ? "translateY(0)" : `translateY(${pull}px)`,
          transition: pulling.current ? undefined : "transform 0.2s ease-out"
        }}
      >
        {children}
      </div>
    </div>
  );
}
