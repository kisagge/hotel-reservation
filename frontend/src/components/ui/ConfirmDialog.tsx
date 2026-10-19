"use client";

import { Button } from "./Button";

export function ConfirmDialog({ open, title, body, confirmLabel, tone = "default", loading, onConfirm, onClose }: {
  open: boolean; title: string; body?: string; confirmLabel: string; tone?: "default" | "danger"; loading?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-40 flex items-end justify-center bg-inverse/40 p-4 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-heading-m font-bold">{title}</h2>
        {body && <p className="mt-2 text-body-m text-ink-2">{body}</p>}
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" size="m" className="flex-1" onClick={onClose}>닫기</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} size="m" className="flex-1" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
