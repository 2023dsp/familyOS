"use client";

import { useEffect, type ReactNode } from "react";

export function ModalBackdrop({
  onClose,
  children,
  variant = "auto"
}: {
  onClose: () => void;
  children: ReactNode;
  variant?: "auto" | "center" | "sheet";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,10,0.32)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 100,
        padding: "32px 16px",
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
          width: "min(620px, 100%)",
          margin: "auto",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {children}
      </div>
    </div>
  );
}
