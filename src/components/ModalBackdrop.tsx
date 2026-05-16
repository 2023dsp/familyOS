"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ModalBackdrop({
  onClose,
  children,
  variant = "auto"
}: {
  onClose: () => void;
  children: ReactNode;
  variant?: "auto" | "center" | "sheet";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  const node = (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100dvh",
        background: "rgba(20,15,10,0.32)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1000,
        padding: "24px 16px",
        overflowY: "auto",
        animation: "fadeIn 0.18s ease both"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={variant === "sheet" ? "slide-up" : "scale-in"}
        data-modal-variant={variant}
        style={{
          background: "var(--surface)",
          borderRadius: 28,
          width: "min(720px, 100%)",
          marginLeft: "auto",
          marginRight: "auto",
          maxHeight: "calc(100dvh - 48px)",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
