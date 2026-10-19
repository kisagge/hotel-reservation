"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

/**
 * Modal confirm. Focus moves to the safe action ("닫기") on open, Tab is trapped inside, Escape closes, and focus
 * returns to whatever opened it.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, tone = "default", loading, onConfirm, onClose }: {
  open: boolean; title: string; body?: string; confirmLabel: string; tone?: "default" | "danger"; loading?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => { closeRef.current = onClose; });

  // Runs only when the dialog opens/closes, so parent re-renders (inline onClose, loading) never move focus.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-inverse/40 p-4 sm:items-center" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={body ? bodyId : undefined}
        className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className="text-heading-m font-bold">{title}</h2>
        {body && <p id={bodyId} className="mt-2 text-body-m text-ink-2">{body}</p>}
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" size="m" className="flex-1" onClick={onClose}>닫기</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} size="m" className="flex-1" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
