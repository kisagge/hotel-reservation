"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { Rules } from "@/lib/api/queries";
import { durationKo, hh } from "@/lib/rulesCopy";
import { AdminPageHeader } from "./AdminPageHeader";
import { Stepper } from "./Stepper";

type Errors = Partial<Record<keyof Rules, string>>;
const PRICE_KEYS = ["dayuse_weekday_price", "dayuse_weekend_price", "stay_weekday_price", "stay_weekend_price"] as const;

/** Client-side copy of the backend SettingsIn rules, so mistakes show next to the field before saving. */
export function validateSettings(v: Rules): Errors {
  const e: Errors = {};
  for (const k of PRICE_KEYS) if (!(v[k] > 0)) e[k] = "0원보다 커야 해요";
  if (v.dayuse_first_start_hour > v.dayuse_last_start_hour) e.dayuse_first_start_hour = "첫 입실은 마지막 입실보다 늦을 수 없어요";
  if (v.stay_check_out_hour >= v.stay_check_in_hour) e.stay_check_out_hour = "체크아웃은 체크인보다 빨라야 해요";
  else if (v.stay_check_out_hour * 60 + v.cleaning_buffer_minutes > v.stay_check_in_hour * 60)
    e.cleaning_buffer_minutes = "체크아웃 후 청소가 다음 체크인 전에 끝나야 해요";
  return e;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function HourSelect({ label, value, onChange, invalid }: { label: string; value: number; onChange: (h: number) => void; invalid?: boolean }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}
      className={cn("h-11 w-[100px] rounded-md border bg-surface px-3 text-body-l outline-none focus:border-pine", invalid ? "border-danger" : "border-field")}>
      {HOURS.map((h) => <option key={h} value={h}>{hh(h)}</option>)}
    </select>
  );
}

function SettingRow({ title, desc, error, children }: { title: string; desc: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6 py-1">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-body-m font-medium">{title}</span>
        <span className="text-caption text-ink-3">{desc}</span>
        {error && <span role="alert" className="text-caption text-danger">{error}</span>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/** A3 · 요금·운영 설정 form (Figma 12:100). `aside` receives the live values (rule preview). */
export function SettingsForm({ initial, onSave, saving, aside }: {
  initial: Rules; onSave: (v: Rules) => Promise<unknown> | void; saving: boolean; aside?: (v: Rules) => React.ReactNode;
}) {
  const [v, setV] = useState<Rules>(initial);
  const set = <K extends keyof Rules>(k: K, val: Rules[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const errors = validateSettings(v);
  const dirty = (Object.keys(initial) as (keyof Rules)[]).some((k) => initial[k] !== v[k]);
  const valid = Object.keys(errors).length === 0;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="요금·운영 설정" subtitle="바꾼 내용은 저장한 뒤 새 예약부터 적용돼요"
        actions={<>
          <Button variant="secondary" size="m" disabled={!dirty} onClick={() => setV(initial)}>되돌리기</Button>
          <Button type="submit" form="settings-form" size="m" disabled={!dirty || !valid} loading={saving}>변경사항 저장</Button>
        </>} />
      <div className="flex items-start gap-4">
        <form id="settings-form" className="flex min-w-0 flex-1 flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); if (dirty && valid) onSave(v); }}>
          <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-heading-m font-bold">요금</h2>
              <p className="text-caption text-ink-2">주말 기준 — 대실: 토·일요일 / 숙박: 금·토요일 밤</p>
            </div>
            <div className="grid grid-cols-[1fr_180px_180px] items-center gap-x-4 gap-y-3">
              <span /><span className="text-label font-medium text-ink-2">평일</span><span className="text-label font-medium text-ink-2">주말</span>
              {([["대실", "dayuse", Sun, "bg-amber-soft text-amber", `${v.dayuse_hours}시간 기준`], ["숙박", "stay", Moon, "bg-pine-soft text-pine", "1박 기준"]] as const).map(([name, key, Icon, tone, sub]) => (
                <div key={key} className="contents">
                  <div className="flex items-center gap-3">
                    <span className={`flex size-9 items-center justify-center rounded-full ${tone}`}><Icon className="size-[18px]" strokeWidth={1.75} /></span>
                    <div className="flex flex-col"><span className="text-heading-s font-bold">{name}</span><span className="text-caption text-ink-3">{sub}</span></div>
                  </div>
                  {(["weekday", "weekend"] as const).map((day) => {
                    const k = `${key}_${day}_price` as (typeof PRICE_KEYS)[number];
                    return (
                      <label key={k} className={cn("flex h-11 items-center gap-1.5 rounded-md border bg-surface px-3.5 focus-within:border-pine", errors[k] ? "border-danger" : "border-field")}>
                        <input type="text" aria-label={`${name} ${day === "weekday" ? "평일" : "주말"} 요금`} inputMode="numeric"
                          value={v[k] ? v[k].toLocaleString("ko-KR") : ""}
                          onChange={(e) => set(k, Number(e.target.value.replace(/\D/g, "")) || 0)}
                          className="w-full bg-transparent text-right text-body-l outline-none" />
                        <span className="text-body-m text-ink-2">원</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-6">
            <h2 className="text-heading-m font-bold">운영 시간</h2>
            <SettingRow title="대실 입실 가능 시간" desc="이 시간 사이에 정시 단위로 입실할 수 있어요" error={errors.dayuse_first_start_hour}>
              <HourSelect label="대실 첫 입실 시각" value={v.dayuse_first_start_hour} onChange={(h) => set("dayuse_first_start_hour", h)} invalid={!!errors.dayuse_first_start_hour} />
              <span className="text-ink-3">~</span>
              <HourSelect label="대실 마지막 입실 시각" value={v.dayuse_last_start_hour} onChange={(h) => set("dayuse_last_start_hour", h)} />
            </SettingRow>
            <hr className="border-line" />
            <SettingRow title="대실 이용 시간" desc="입실부터 퇴실까지 이용할 수 있는 시간">
              <Stepper label="대실 이용 시간" value={v.dayuse_hours} display={`${v.dayuse_hours}시간`} min={1} max={12} onChange={(n) => set("dayuse_hours", n)} />
            </SettingRow>
            <hr className="border-line" />
            <SettingRow title="숙박 체크인 · 체크아웃" desc="체크아웃은 다음 날 기준이에요" error={errors.stay_check_out_hour}>
              <HourSelect label="체크인 시각" value={v.stay_check_in_hour} onChange={(h) => set("stay_check_in_hour", h)} />
              <span className="text-ink-3">→</span>
              <HourSelect label="체크아웃 시각" value={v.stay_check_out_hour} onChange={(h) => set("stay_check_out_hour", h)} invalid={!!errors.stay_check_out_hour} />
            </SettingRow>
            <hr className="border-line" />
            <SettingRow title="최대 연박" desc="한 번에 예약할 수 있는 최대 숙박 일수">
              <Stepper label="최대 연박" value={v.stay_max_nights} display={`${v.stay_max_nights}박`} min={1} max={30} onChange={(n) => set("stay_max_nights", n)} />
            </SettingRow>
          </section>

          <section className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-6">
            <h2 className="text-heading-m font-bold">공통 정책</h2>
            <SettingRow title="청소 시간" desc="퇴실 후 다음 입실까지 비워두는 시간. 모든 예약 뒤에 자동으로 붙어요" error={errors.cleaning_buffer_minutes}>
              <Stepper label="청소 시간" value={v.cleaning_buffer_minutes} display={v.cleaning_buffer_minutes ? durationKo(v.cleaning_buffer_minutes) : "없음"}
                step={30} min={0} max={240} onChange={(n) => set("cleaning_buffer_minutes", n)} />
            </SettingRow>
            <hr className="border-line" />
            <SettingRow title="손님 취소 마감" desc="이 시간 이후에는 손님이 직접 취소할 수 없어요. 이미 받은 예약은 예약 당시 기준을 따라요">
              <Stepper label="취소 마감" value={v.guest_cancel_deadline_hours} display={`${v.guest_cancel_deadline_hours}시간 전`}
                min={0} max={168} onChange={(n) => set("guest_cancel_deadline_hours", n)} />
            </SettingRow>
          </section>
        </form>
        {aside && <div className="flex w-[400px] shrink-0 flex-col gap-4">{aside(v)}</div>}
      </div>
    </div>
  );
}
