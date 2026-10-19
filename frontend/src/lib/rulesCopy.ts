import type { Rules } from "@/lib/api/queries";

export const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** 60 → "1시간", 90 → "1시간 30분", 30 → "30분" */
export function durationKo(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(" ") || "0분";
}

/** Usage-guide rows shown on the home screen, always derived from the live rules. */
export function guideRows(r: Rules): [string, string][] {
  return [
    ["대실 입실", `${hh(r.dayuse_first_start_hour)} ~ ${hh(r.dayuse_last_start_hour)} 정시 입실`],
    ["대실 이용", `입실 후 ${r.dayuse_hours}시간`],
    ["숙박", `체크인 ${hh(r.stay_check_in_hour)} · 체크아웃 ${hh(r.stay_check_out_hour)}`],
    ["청소 시간", r.cleaning_buffer_minutes ? `퇴실 후 ${durationKo(r.cleaning_buffer_minutes)}은 예약 불가` : "청소 시간 없음"],
    ["취소", `이용 ${r.guest_cancel_deadline_hours}시간 전까지 무료 취소`],
  ];
}
