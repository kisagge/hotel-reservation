"use client";

import { Clock } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Splash } from "@/components/brand/Splash";
import { CalendarMonth, type DayState } from "@/components/ui/CalendarMonth";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TimeSlotGrid } from "@/components/ui/TimeSlotGrid";
import { useRoom, type Rules } from "@/lib/api/queries";
import { formatDateKo, formatShortDate, formatTime, formatWon } from "@/lib/format";
import { durationKo, hh } from "@/lib/rulesCopy";
import { addDays, diffDays, todayKst, type YMD } from "@/lib/time";
import { BookingSummary } from "./BookingSummary";
import { EMPTY_RANGE, nightsOf, stayRangeReducer, type StayRange } from "./stayRange";
import { checkoutHref, useDayuseSlots, useQuote, useStayDays, type QuoteIn } from "./useAvailability";

type Tab = "dayuse" | "stay";
const MONTHS_AHEAD = 3;
const isYmd = (v: string | null): v is YMD => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const monthOf = (d: YMD) => d.slice(0, 7);
const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/** G2 (대실) / G3 (숙박). All selection state lives in the URL so reloads and "back" keep it. */
export function BookingScreen() {
  const room = useRoom();
  if (!room.data) return <Splash />;
  return <Booking rules={room.data.rules} />;
}

function Booking({ rules }: { rules: Rules }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = todayKst();
  const tab: Tab = sp.get("tab") === "stay" ? "stay" : "dayuse";
  const minMonth = monthOf(today);
  const maxMonth = shiftMonth(minMonth, MONTHS_AHEAD);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const date = isYmd(sp.get("date")) && sp.get("date")! >= today ? sp.get("date")! : null;
  const hourRaw = Number(sp.get("hour"));
  const hour = date && Number.isInteger(hourRaw) && sp.get("hour") ? hourRaw : null;
  const range: StayRange = {
    checkIn: isYmd(sp.get("in")) && sp.get("in")! >= today ? sp.get("in") : null,
    checkOut: isYmd(sp.get("out")) ? sp.get("out") : null,
  };
  if (range.checkIn && range.checkOut && range.checkOut <= range.checkIn) range.checkOut = null;
  const anchor = tab === "dayuse" ? date : range.checkIn;
  const viewMonthRaw = sp.get("m") ?? (anchor ? monthOf(anchor) : minMonth);
  const viewMonth = viewMonthRaw < minMonth ? minMonth : viewMonthRaw > maxMonth ? maxMonth : viewMonthRaw;
  const [year, month] = viewMonth.split("-").map(Number);

  const slots = useDayuseSlots(tab === "dayuse" ? date : null);
  const stayDays = useStayDays(viewMonth);
  const availability = useMemo(() => new Map(stayDays.data?.days.map((d) => [d.date, d.available])), [stayDays.data]);
  const nightOk = (d: YMD) => availability.get(d) ?? true; // nights outside the loaded month: the quote decides

  const nights = nightsOf(range);
  const quoteIn: QuoteIn | null =
    tab === "dayuse"
      ? date && hour !== null ? { type: "DAYUSE", date, start_hour: hour } : null
      : range.checkIn && nights ? { type: "STAY", check_in: range.checkIn, nights } : null;
  const quote = useQuote(quoteIn);

  const pickStay = (d: YMD) => {
    const r = stayRangeReducer(range, { type: "pick", date: d, isAvailable: nightOk, maxNights: rules.stay_max_nights });
    set({ in: r.checkIn, out: r.checkOut });
  };
  const validCheckout = (d: YMD) => {
    if (!range.checkIn || range.checkOut || d <= range.checkIn) return false;
    const n = diffDays(range.checkIn, d);
    return n <= rules.stay_max_nights && Array.from({ length: n }, (_, i) => addDays(range.checkIn!, i)).every(nightOk);
  };

  const dayState = (d: YMD): DayState => {
    if (d < today) return "disabled";
    if (tab === "dayuse") return d === date ? "selected" : "default";
    if (d === range.checkIn || d === range.checkOut) return "selected";
    if (range.checkIn && range.checkOut && d > range.checkIn && d < range.checkOut) return "inRange";
    if (validCheckout(d)) return "default";
    return availability.get(d) === false ? "soldout" : "default";
  };

  const q = quote.data;
  const summary =
    tab === "dayuse"
      ? date && q ? { caption: `${formatDateKo(date)} · 대실`, title: `${formatTime(q.start_at)} ~ ${formatTime(q.end_at) === "00:00" ? "24:00" : formatTime(q.end_at)} (${rules.dayuse_hours}시간)` } : null
      : range.checkIn && range.checkOut && q ? { caption: `${formatShortDate(range.checkIn)} → ${formatShortDate(range.checkOut)} · 숙박`, title: `${nights}박 · 체크인 ${formatTime(q.start_at)}` } : null;

  return (
    <main className="flex flex-1 flex-col">
      <MobileHeader title="예약하기" back="/" />
      <div className="px-4 pb-2 pt-1">
        <SegmentedTabs items={[{ value: "dayuse", label: "대실" }, { value: "stay", label: "숙박" }]} value={tab}
          onChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })} />
      </div>

      <div className="flex flex-col gap-6 px-4 pb-6 pt-2">
        <CalendarMonth year={year} month={month} today={today} dayState={dayState}
          canPrev={viewMonth > minMonth} canNext={viewMonth < maxMonth}
          onMonthChange={(delta) => set({ m: shiftMonth(viewMonth, delta) })}
          onSelect={(d) => (tab === "dayuse" ? set({ date: d, hour: null }) : pickStay(d))} />

        {tab === "dayuse" ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-heading-s font-bold">입실 시간</h2>
              {date && <span className="text-caption text-ink-2">{formatDateKo(date)} · {rules.dayuse_hours}시간 이용</span>}
            </div>
            {!date ? (
              <p className="rounded-md bg-surface px-4 py-6 text-center text-body-m text-ink-3">날짜를 먼저 선택해 주세요</p>
            ) : slots.data ? (
              <TimeSlotGrid slots={slots.data.slots} selected={hour} onSelect={(h) => set({ hour: String(h) })} />
            ) : (
              <div className="h-[184px] animate-pulse rounded-md bg-muted" />
            )}
            <p className="flex items-center gap-2 rounded-md bg-muted px-3.5 py-3 text-caption text-ink-2">
              <Clock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              앞 예약 퇴실 후 청소 시간({durationKo(rules.cleaning_buffer_minutes)}) 동안은 입실할 수 없어요.
            </p>
          </section>
        ) : (
          <>
            <ul className="flex items-center gap-4 text-caption text-ink-2">
              <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-pine" />체크인·체크아웃</li>
              <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-pine-soft" />숙박 기간</li>
              <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-disabled" />예약 마감</li>
            </ul>
            {range.checkIn && (
              <div className="flex items-center rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-caption text-ink-3">체크인</span>
                  <span className="text-heading-s font-bold">{formatShortDate(range.checkIn)}</span>
                  <span className="text-body-m text-ink-2">{hh(rules.stay_check_in_hour)}</span>
                </div>
                {nights && <span className="rounded-full bg-pine-soft px-3 py-1 text-label font-medium text-pine">{nights}박</span>}
                <div className="flex flex-1 flex-col items-end gap-0.5">
                  <span className="text-caption text-ink-3">체크아웃</span>
                  {range.checkOut ? (
                    <>
                      <span className="text-heading-s font-bold">{formatShortDate(range.checkOut)}</span>
                      <span className="text-body-m text-ink-2">{hh(rules.stay_check_out_hour)}</span>
                    </>
                  ) : (
                    <span className="text-heading-s font-bold text-ink-3">날짜 선택</span>
                  )}
                </div>
              </div>
            )}
            {q && range.checkOut && (
              <section className="flex flex-col gap-2.5">
                <h2 className="text-heading-s font-bold">요금 상세</h2>
                {q.lines.map((l) => (
                  <div key={l.label} className="flex justify-between text-body-m">
                    <span className="text-ink-2">{l.label}</span><span className="font-medium">{formatWon(l.amount)}</span>
                  </div>
                ))}
                <hr className="border-line" />
                <div className="flex items-center justify-between">
                  <span className="text-body-m font-medium">합계</span><span className="text-heading-m font-bold">{formatWon(q.total)}</span>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <BookingSummary caption={summary?.caption} title={summary?.title} quote={summary ? q : undefined}
        loading={quote.isFetching} href={quoteIn ? checkoutHref(quoteIn) : null}
        hint={tab === "dayuse" ? "날짜와 입실 시간을 선택해 주세요" : range.checkIn ? "체크아웃 날짜를 선택해 주세요" : "체크인 날짜를 선택해 주세요"} />
    </main>
  );
}
