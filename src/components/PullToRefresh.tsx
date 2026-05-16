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
  const pullRef = useRef(0);
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
      if (el.scrollTop > 0) {
        // user scrolled away from top, abort PTR for this gesture
        pulling.current = false;
        startY.current = null;
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      const y = e.touches[0]?.clientY ?? startY.current;
      const dy = y - startY.current;
      if (dy <= 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      const damped = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = damped;
      setPull(damped);
      if (dy > 8) e.preventDefault();
    }
    async function end() {
      const wasPulling = pulling.current;
      pulling.current = false;
      startY.current = null;
      if (!wasPulling) return;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        try {
          await onRefresh();
        } catch {
          /* ignore */
        }
        setTimeout(() => setRefreshing(false), 300);
      }
      pullRef.current = 0;
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
  }, [onRefresh]);

  const visible = refreshing || pull > 0;
  const armed = pull >= THRESHOLD;
  const indicatorTop = refreshing ? 12 : Math.min(pull - 28, 12);

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, position: "relative", overscrollBehaviorY: "contain" }}
    >
      {visible && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: indicatorTop,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            pointerEvents: "none",
            transition: refreshing ? "top 0.2s" : "none"
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 99,
              background: "var(--surface)",
              boxShadow: "var(--shadow)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink-2)",
              opacity: Math.min(1, refreshing ? 1 : pull / THRESHOLD)
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
              <Icon name="refresh" color="var(--terracotta)" size={14} />
            </span>
            {refreshing ? "Refreshing…" : armed ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
