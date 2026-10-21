"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/Dialog";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TextField } from "@/components/ui/TextField";
import { useAdminQuote, useReschedule, useWalkIn, type AdminReservation, type QuoteBody } from "@/lib/api/adminQueries";
import { ApiError, useRoom } from "@/lib/api/queries";
import { errorMessage } from "@/lib/errors";
import { formatAdminRange, formatWon } from "@/lib/format";
import { kstParts, todayKst, type YMD } from "@/lib/time";
import { defaultSlot } from "./bookingDefaults";

export type BookingDialogMode = { kind: "create" } | { kind: "reschedule"; reservation: AdminReservation };
type Kind = "DAYUSE" | "STAY";

const control = "h-12 rounded-md border border-field bg-surface px-3 text-body-l text-ink outline-none focus:border-[1.5px] focus:border-pine";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-ink-2">{label}</label>
      {children(id)}
    </div>
  );
}

function initial(mode: BookingDialogMode) {
  // create: date and hour stay null ("next open slot") until the admin picks them
  if (mode.kind === "create") return { kind: "DAYUSE" as Kind, date: null, hour: null, nights: 1 };
  const r = mode.reservation;
  const start = kstParts(r.start_at);
  return { kind: (r.type === "STAY" ? "STAY" : "DAYUSE") as Kind, date: start.ymd, hour: r.type === "STAY" ? null : start.hour, nights: r.nights ?? 1 };
}

/** A2 · 예약 추가(현장·전화 예약) and 일정 변경. Price and availability come from the admin quote. */
export function BookingDialog({ open, mode, onClose, onDone }: {
  open: boolean; mode: BookingDialogMode; onClose: () => void; onDone: (r: AdminReservation) => void;
}) {
  const titleId = useId();
  // Owned here, not by the form: the dialog cannot be dismissed while a request is in flight, so its result
  // (toast, reveal) always lands.
  const walkIn = useWalkIn();
  const reschedule = useReschedule();
  const pending = walkIn.isPending || reschedule.isPending;
  return (
    <Dialog open={open} onClose={onClose} dismissible={!pending} labelledBy={titleId} className="max-w-md">
      {/* keyed so reopening for another booking starts from that booking's values */}
      <Form key={mode.kind === "create" ? "create" : mode.reservation.id} titleId={titleId} mode={mode} onClose={onClose}
        onDone={onDone} walkIn={walkIn} reschedule={reschedule} />
    </Dialog>
  );
}

function Form({ titleId, mode, onClose, onDone, walkIn, reschedule }: {
  titleId: string; mode: BookingDialogMode; onClose: () => void; onDone: (r: AdminReservation) => void;
  walkIn: ReturnType<typeof useWalkIn>; reschedule: ReturnType<typeof useReschedule>;
}) {
  const room = useRoom();
  const rules = room.data?.rules;
  const start = initial(mode);
  const [kind, setKind] = useState<Kind>(start.kind);
  const [date, setDate] = useState<YMD | null>(start.date);
  const [openedAt] = useState(() => kstParts(new Date().toISOString()));
  const [hour, setHour] = useState<number | null>(start.hour);
  const [nights, setNights] = useState(start.nights);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const pending = walkIn.isPending || reschedule.isPending;
  const failure = walkIn.error ?? reschedule.error;

  const editing = mode.kind === "reschedule" ? mode.reservation : null;
  const auto = rules ? defaultSlot(rules, openedAt) : null;
  const day = date ?? auto?.date ?? openedAt.ymd;
  const startHour = hour ?? auto?.hour ?? rules?.dayuse_first_start_hour ?? 0;
  const body: QuoteBody | null = !rules || !YMD_RE.test(day) ? null
    : kind === "DAYUSE" ? { type: "DAYUSE", date: day, start_hour: startHour } : { type: "STAY", check_in: day, nights };
  const quote = useAdminQuote(body, editing?.id ?? null);
  const q = quote.data;
  const guestOk = !!editing || (name.trim().length > 0 && phone.trim().length >= 9);
  const unchanged = !!editing && !!q && q.type === editing.type
    && Date.parse(q.start_at) === Date.parse(editing.start_at) && Date.parse(q.end_at) === Date.parse(editing.end_at);
  const canSubmit = !!body && !!q?.available && !quote.isFetching && guestOk && !pending && !unchanged;

  const submit = () => {
    if (!body) return;
    const done = { onSuccess: (r: AdminReservation) => onDone(r) };
    if (editing) reschedule.mutate({ id: editing.id, body }, done);
    else walkIn.mutate({ ...body, guest_name: name.trim(), guest_phone: phone.trim() }, done);
  };

  // Today's rules, plus the booking's own value if the rules have since changed (the quote then says why).
  const withCurrent = (values: number[], current: number | null) =>
    current === null || values.includes(current) ? values : [...values, current].sort((a, b) => a - b);
  const hours = withCurrent(rules ? Array.from({ length: rules.dayuse_last_start_hour - rules.dayuse_first_start_hour + 1 }, (_, i) => rules.dayuse_first_start_hour + i) : [], hour);
  const nightOptions = withCurrent(rules ? Array.from({ length: rules.stay_max_nights }, (_, i) => i + 1) : [1], nights);

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit(); }}>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-heading-m font-bold">{editing ? "일정 변경" : "예약 추가"}</h2>
        <p className="text-body-m text-ink-2">
          {editing ? `${editing.code} · ${editing.guest_name} · 지금 ${formatAdminRange(editing.start_at, editing.end_at)}` : "전화·현장 예약을 직접 등록해요. 손님 예약과 같은 규칙이 적용돼요."}
        </p>
      </div>
      <SegmentedTabs label="유형" size="m" value={kind} onChange={setKind}
        items={[{ value: "DAYUSE", label: "대실" }, { value: "STAY", label: "숙박" }]} />
      <div className="flex gap-3">
        <Field label={kind === "DAYUSE" ? "날짜" : "체크인 날짜"}>
          {(id) => <input id={id} data-autofocus type="date" required min={todayKst()} value={day} onChange={(e) => { setDate(e.target.value); setHour(startHour); }} className={control} />}
        </Field>
        {kind === "DAYUSE" ? (
          <Field label="입실 시간">
            {(id) => (
              <select id={id} value={startHour} onChange={(e) => setHour(Number(e.target.value))} className={control}>
                {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00 ~ {String(h + (rules?.dayuse_hours ?? 0)).padStart(2, "0")}:00</option>)}
              </select>
            )}
          </Field>
        ) : (
          <Field label="박 수">
            {(id) => (
              <select id={id} value={nights} onChange={(e) => setNights(Number(e.target.value))} className={control}>
                {nightOptions.map((n) => <option key={n} value={n}>{n}박</option>)}
              </select>
            )}
          </Field>
        )}
      </div>
      {!editing && (
        <div className="flex gap-3">
          <TextField className="flex-1" label="예약자 이름" maxLength={30} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField className="flex-1" label="연락처" type="tel" maxLength={20} autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      )}
      <div aria-live="polite" aria-busy={quote.isPlaceholderData || undefined}
        className={cn("flex min-h-[64px] flex-col justify-center rounded-md bg-canvas px-4 py-3 transition-opacity", quote.isPlaceholderData && "opacity-50")}>
        {quote.isError ? (
          <p className="text-body-m text-danger">{errorMessage(quote.error instanceof ApiError ? quote.error.code : null)}</p>
        ) : !q ? (
          <p className="text-body-m text-ink-3">요금을 확인하고 있어요</p>
        ) : !q.available ? (
          <p className="text-body-m text-danger">
            {q.reason === "SLOT_UNAVAILABLE" ? "선택한 일정에 다른 예약이나 차단 일정이 있어요" : errorMessage(q.reason)}
          </p>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body-m text-ink-2">{formatAdminRange(q.start_at, q.end_at)}</span>
            <span className="flex flex-col items-end">
              <span className="text-heading-m font-bold">{formatWon(q.total)}</span>
              {unchanged && <span className="text-caption text-ink-2">지금 일정과 같아요</span>}
              {editing && !unchanged && q.total !== editing.total_price && (
                <span className="text-caption text-ink-2">
                  기존 {formatWon(editing.total_price)} · {q.total > editing.total_price ? "+" : "−"}{formatWon(Math.abs(q.total - editing.total_price))}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      {failure && <p role="alert" className="-mt-2 text-body-m text-danger">{errorMessage(failure instanceof ApiError ? failure.code : null)}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" size="m" className="flex-1" disabled={pending} onClick={onClose}>닫기</Button>
        <Button type="submit" size="m" className="flex-1" disabled={!canSubmit} loading={pending}>{editing ? "일정 변경하기" : "예약 만들기"}</Button>
      </div>
    </form>
  );
}
