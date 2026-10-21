"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal shell. Focus moves to the first `[data-autofocus]` (else the first focusable) on open, Tab is trapped
 * inside, Escape and the backdrop close it, and focus returns to whatever opened it. `dismissible={false}` (e.g.
 * while a request is in flight) ignores Escape and the backdrop.
 */
export function Dialog({ open, onClose, labelledBy, describedBy, className, dismissible = true, children }: {
  open: boolean; onClose: () => void; labelledBy: string; describedBy?: string; className?: string; dismissible?: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(() => {});
  const pressedBackdrop = useRef(false);
  useEffect(() => { closeRef.current = dismissible ? onClose : () => {}; });

  // Runs only when the dialog opens/closes, so parent re-renders (inline onClose, loading) never move focus.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const p = panel.current;
    (p?.querySelector<HTMLElement>("[data-autofocus]") ?? p?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // the opener (e.g. a cancelled card's button) may be gone; fall back to the page's main region
      (opener?.isConnected ? opener : document.getElementById("main"))?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    // Close only for a click that both starts and ends on the backdrop: a text selection dragged out of a field
    // must not throw the form away.
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-inverse/40 p-4 sm:items-center"
      onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (pressedBackdrop.current && e.target === e.currentTarget) closeRef.current(); pressedBackdrop.current = false; }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}
        className={cn("w-full max-w-sm rounded-xl bg-surface p-6 shadow-card", className)}>
        {children}
      </div>
    </div>
  );
}
