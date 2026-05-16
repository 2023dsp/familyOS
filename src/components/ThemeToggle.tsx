"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem("familyos-theme");
  return v === "dark" ? "dark" : "light";
}

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.toggle("theme-dark", t === "dark");
  html.dataset.theme = t;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem("familyos-theme", next);
  }

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost"
      type="button"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      style={compact ? { width: 36, height: 36, borderRadius: 99, padding: 0 } : undefined}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} color="var(--ink-2)" size={16} />
      {!compact && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}
