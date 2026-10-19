"use client";

import { CalendarDays, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Splash } from "@/components/brand/Splash";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { TextField } from "@/components/ui/TextField";
import { useMe, useRoom, type Rules, type User } from "@/lib/api/queries";
import { errorMessage } from "@/lib/errors";
import { formatDateKo, formatShortDate, formatTime, formatWon, weekdayKo } from "@/lib/format";
import { kstParts } from "@/lib/time";
import { bookingHref, parseCheckoutParams } from "./checkoutParams";
import { useCreateReservation } from "./useCheckout";
import { useQuote, type Quote, type QuoteIn } from "./useAvailability";

/** G4 · 예약 확인 및 결제 (Figma 8:131). */
export function CheckoutScreen() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = parseCheckoutParams(new URLSearchParams(sp.toString()));
  const me = useMe();
  const room = useRoom();
  const quote = useQuote(q);

  useEffect(() => {
    if (!q) router.replace("/book");
  }, [q, router]);

  if (!q || !me.data || !room.data || !quote.data) return <Splash />;
  return <Checkout q={q} user={me.data} roomName={room.data.name} rules={room.data.rules} quote={quote.data} />;
}

function cancelDeadline(startIso: string, hours: number) {
  const iso = new Date(Date.parse(startIso) - hours * 3_600_000).toISOString();
  return `${formatDateKo(kstParts(iso).ymd)} ${formatTime(iso)}`;
}

function Checkout({ q, user, roomName, rules, quote }: { q: QuoteIn; user: User; roomName: string; rules: Rules; quote: Quote }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [agreed, setAgreed] = useState(false);
  const { submit, isPending } = useCreateReservation(q);
  const start = kstParts(quote.start_at);
  const end = kstParts(quote.end_at);
  const valid = name.trim().length > 0 && phone.trim().length >= 9;

  return (
    <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
      <MobileHeader title="예약 확인" back={bookingHref(q)} />
      <div className="flex flex-col gap-7 px-4 pb-6 pt-2">
        <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4">
          <Badge kind={q.type} />
          <h2 className="text-heading-m font-bold">{roomName}</h2>
          <p className="flex items-center gap-2 text-body-m font-medium">
            <CalendarDays className="size-[18px] text-ink-2" strokeWidth={1.75} aria-hidden />
            {q.type === "DAYUSE" ? `${start.ymd.replaceAll("-", ".")} (${weekdayKo(start.ymd)})` : `${formatShortDate(start.ymd)} → ${formatShortDate(end.ymd)}`}
          </p>
          <p className="flex items-center gap-2 text-body-m font-medium">
            <Clock className="size-[18px] text-ink-2" strokeWidth={1.75} aria-hidden />
            {q.type === "DAYUSE"
              ? `${formatTime(quote.start_at)} ~ ${end.hour === 0 && end.ymd !== start.ymd ? "24:00" : formatTime(quote.end_at)} · ${rules.dayuse_hours}시간 이용`
              : `체크인 ${formatTime(quote.start_at)} · 체크아웃 ${formatTime(quote.end_at)} · ${quote.nights}박`}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-heading-s font-bold">예약자 정보</h2>
          <TextField label="예약자 이름" autoComplete="name" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="연락처" type="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)}
            help="입실 안내 문자를 보내드려요" />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-heading-s font-bold">결제 수단</h2>
          <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-pine bg-surface p-4">
            <span className="size-5 rounded-full border-[6px] border-pine" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-heading-s font-bold">모의 결제</span>
              <span className="text-caption text-ink-2">포트폴리오 데모용이에요. 실제로 결제되지 않아요.</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-heading-s font-bold">결제 금액</h2>
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            {quote.lines.map((l) => (
              <div key={l.label} className="flex justify-between text-body-m">
                <span className="text-ink-2">{l.label}</span><span className="font-medium">{formatWon(l.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-body-m"><span className="text-ink-2">할인</span><span className="font-medium">0원</span></div>
            <hr className="border-line" />
            <div className="flex items-center justify-between">
              <span className="text-body-m text-ink-2">총 결제금액</span>
              <span className="text-heading-m font-bold text-pine">{formatWon(quote.total)}</span>
            </div>
          </div>
        </section>

        {!quote.available && (
          <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-3 text-body-m text-danger">
            {errorMessage(quote.reason)} <Link href={bookingHref(q)} className="underline">다시 선택하기</Link>
          </p>
        )}

        <p className="flex gap-2 rounded-md bg-amber-soft px-3.5 py-3 text-caption text-amber">
          <Clock className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>{cancelDeadline(quote.start_at, rules.guest_cancel_deadline_hours)}까지 무료로 취소할 수 있어요.<br />이후에는 취소할 수 없어요.</span>
        </p>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" className="peer sr-only" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span aria-hidden className={cn("flex size-[22px] items-center justify-center rounded-[6px] border",
            agreed ? "border-pine bg-pine text-white" : "border-field bg-surface", "peer-focus-visible:ring-2 peer-focus-visible:ring-pine/40")}>
            {agreed && <Check className="size-4" strokeWidth={2.5} />}
          </span>
          <span className="text-body-m font-medium">예약 정보와 취소 규정을 확인했어요</span>
        </label>
      </div>

      <div className="sticky bottom-0 mt-auto bg-surface px-5 pb-8 pt-3 shadow-sheet">
        <Button className="w-full" loading={isPending} disabled={!agreed || !valid || !quote.available}
          onClick={() => submit({ guest_name: name.trim(), guest_phone: phone.trim() })}>
          {formatWon(quote.total)} 결제하기
        </Button>
      </div>
    </main>
  );
}
