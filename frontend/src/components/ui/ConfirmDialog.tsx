"use client";

import { useId } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

/** Modal confirm; focus starts on the safe action ("닫기"). */
export function ConfirmDialog({ open, title, body, confirmLabel, tone = "default", loading, onConfirm, onClose }: {
  open: boolean; title: string; body?: string; confirmLabel: string; tone?: "default" | "danger"; loading?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} describedBy={body ? bodyId : undefined}>
      <h2 id={titleId} className="text-heading-m font-bold">{title}</h2>
      {body && <p id={bodyId} className="mt-2 text-body-m text-ink-2">{body}</p>}
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" size="m" className="flex-1" onClick={onClose}>닫기</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} size="m" className="flex-1" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
