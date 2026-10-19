"use client";

import { Ban } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useBlocks, useCreateBlock, useDeleteBlock, type Block } from "@/lib/api/adminQueries";
import { ApiError } from "@/lib/api/queries";
import { errorMessage } from "@/lib/errors";
import { formatAdminRange } from "@/lib/format";

const toKstIso = (local: string) => `${local}:00+09:00`; // datetime-local value is entered as KST wall time
const input = "h-11 rounded-md border border-line-strong bg-surface px-3 text-body-m outline-none focus:border-pine";

/** A3 "차단 일정" card (anchor #blocks). */
export function BlocksCard() {
  const blocks = useBlocks();
  const create = useCreateBlock();
  const remove = useDeleteBlock();
  const toast = useToast();
  const ref = useRef<HTMLElement>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ start: "", end: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Block | null>(null);

  useEffect(() => {
    if (window.location.hash === "#blocks") ref.current?.scrollIntoView({ block: "start" });
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.start || !form.end || form.end <= form.start) return setError("종료 일시는 시작 일시보다 늦어야 해요");
    create.mutate({ start_at: toKstIso(form.start), end_at: toKstIso(form.end), reason: form.reason.trim() || "차단" }, {
      onSuccess: () => { toast("차단 일정을 추가했어요"); setForm({ start: "", end: "", reason: "" }); setAdding(false); },
      onError: (err) => setError(errorMessage(err instanceof ApiError ? err.code : null)),
    });
  };

  return (
    <section id="blocks" ref={ref} className="flex scroll-mt-6 flex-col gap-3 rounded-lg border border-line bg-surface p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-heading-m font-bold">차단 일정</h2>
        <p className="text-caption text-ink-2">점검이나 개인 사용으로 예약을 막아둔 기간</p>
      </div>
      {blocks.data?.length === 0 && <p className="py-2 text-body-m text-ink-3">예정된 차단 일정이 없어요</p>}
      {blocks.data?.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-md bg-canvas p-3">
          <Ban className="size-[18px] shrink-0 text-danger" strokeWidth={1.75} aria-hidden />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-body-m font-medium">{formatAdminRange(b.start_at, b.end_at)}</span>
            <span className="text-caption text-ink-2">{b.reason}</span>
          </div>
          <button type="button" onClick={() => setTarget(b)} className="text-label font-medium text-danger">삭제</button>
        </div>
      ))}
      {adding ? (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border border-line p-3">
          <label className="flex flex-col gap-1 text-label font-medium text-ink-2">시작 일시
            <input type="datetime-local" step={3600} className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required />
          </label>
          <label className="flex flex-col gap-1 text-label font-medium text-ink-2">종료 일시
            <input type="datetime-local" step={3600} className={input} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} required />
          </label>
          <label className="flex flex-col gap-1 text-label font-medium text-ink-2">사유
            <input className={input} maxLength={100} placeholder="정기 점검" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          {error && <p role="alert" className="text-caption text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="m" className="flex-1" onClick={() => { setAdding(false); setError(null); }}>닫기</Button>
            <Button type="submit" size="m" className="flex-1" loading={create.isPending}>추가하기</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="m" onClick={() => setAdding(true)}>+ 차단 일정 추가</Button>
      )}
      <ConfirmDialog open={!!target} tone="danger" title="차단 일정을 삭제할까요?" confirmLabel="삭제하기" loading={remove.isPending}
        body={target ? `${formatAdminRange(target.start_at, target.end_at)} · ${target.reason}. 삭제하면 그 기간에 예약을 받을 수 있어요.` : undefined}
        onConfirm={() => target && remove.mutate(target.id, { onSuccess: () => toast("차단 일정을 삭제했어요"), onSettled: () => setTarget(null) })}
        onClose={() => setTarget(null)} />
    </section>
  );
}
