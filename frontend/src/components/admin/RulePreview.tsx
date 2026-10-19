import type { Rules } from "@/lib/api/queries";
import { durationKo, hh } from "@/lib/rulesCopy";
import { DayTimeline } from "./DayTimeline";
import type { Segment } from "./timeline";

/** A3 "규칙 미리보기": how the current (unsaved) settings carve up a day. */
export function RulePreview({ rules: r }: { rules: Rules }) {
  const buffer = r.cleaning_buffer_minutes / 60;
  // 1) After a check-out: first day-use start on the hour once cleaning is done.
  const afterOut = Math.max(Math.ceil(r.stay_check_out_hour + buffer), r.dayuse_first_start_hour);
  const ex1: Segment[] = [
    { kind: "STAY", fromHour: 0, toHour: r.stay_check_out_hour },
    ...(buffer ? [{ kind: "CLEANING" as const, fromHour: r.stay_check_out_hour, toHour: r.stay_check_out_hour + buffer }] : []),
    ...(afterOut + r.dayuse_hours <= 24 ? [{ kind: "DAYUSE" as const, fromHour: afterOut, toHour: afterOut + r.dayuse_hours }] : []),
  ];
  // 2) Before a check-in: latest day-use start that still leaves cleaning time.
  const latest = Math.floor(r.stay_check_in_hour - buffer - r.dayuse_hours);
  const ex2: Segment[] = [
    ...(latest >= r.dayuse_first_start_hour ? [
      { kind: "DAYUSE" as const, fromHour: latest, toHour: latest + r.dayuse_hours },
      ...(buffer ? [{ kind: "CLEANING" as const, fromHour: latest + r.dayuse_hours, toHour: latest + r.dayuse_hours + buffer }] : []),
    ] : []),
    { kind: "STAY", fromHour: r.stay_check_in_hour, toHour: 24 },
  ];
  const fill = (segs: Segment[]) => {
    const out: Segment[] = [];
    let c = 0;
    for (const s of segs) { if (s.fromHour > c) out.push({ kind: "FREE", fromHour: c, toHour: s.fromHour }); out.push(s); c = s.toHour; }
    if (c < 24) out.push({ kind: "FREE", fromHour: c, toHour: 24 });
    return out;
  };
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-heading-m font-bold">규칙 미리보기</h2>
        <p className="text-caption text-ink-2">지금 설정이면 하루가 이렇게 나뉘어요</p>
      </div>
      <DayTimeline segments={fill(ex1)} height={36} compact />
      <p className="-mt-2 text-caption text-ink-2">
        숙박 손님이 {hh(r.stay_check_out_hour)}에 나가면 {buffer ? `청소 ${durationKo(r.cleaning_buffer_minutes)} 뒤 ` : ""}{hh(afterOut)}부터 대실을 받을 수 있어요.
      </p>
      <DayTimeline segments={fill(ex2)} height={36} compact />
      <p className="-mt-2 text-caption text-ink-2">
        {latest >= r.dayuse_first_start_hour
          ? `같은 날 ${hh(r.stay_check_in_hour)} 숙박이 있으면 대실은 ${hh(latest)} 입실까지만 가능해요.`
          : `같은 날 ${hh(r.stay_check_in_hour)} 숙박이 있으면 그날은 대실을 받을 수 없어요.`}
      </p>
    </section>
  );
}
