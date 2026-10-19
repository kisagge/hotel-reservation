import { Bath, Check, Coffee, ImageIcon, Moon, SquareParking, Sun, Tv, User, Wifi, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Room } from "@/lib/api/queries";
import { guideRows, hh } from "@/lib/rulesCopy";

const AMENITY_ICON: Record<string, LucideIcon> = { 와이파이: Wifi, 스마트TV: Tv, 욕조: Bath, 커피머신: Coffee, 무료주차: SquareParking };
const PLACEHOLDER_FILLS = ["bg-amber-soft text-amber", "bg-pine-soft text-pine"];

/** G1 · 홈 (Figma 6:10). */
export function HomeView({ room, loggedIn }: { room: Room; loggedIn: boolean }) {
  const r = room.rules;
  const shown = room.photos.slice(0, 2);
  const more = Math.max(room.photos.length - 2, 0);
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-display-s font-bold">HARU</span>
          <span className="text-caption text-ink-3">하루</span>
        </div>
        <div className="flex items-center gap-4">
          {loggedIn ? (
            <Link href="/me/reservations" className="text-body-m font-medium text-ink-2">내 예약</Link>
          ) : (
            <Link href="/login" className="text-body-m font-medium text-ink-2">로그인</Link>
          )}
          <User className="size-6" strokeWidth={1.75} aria-hidden />
        </div>
      </header>

      <section className="px-4">
        <div className="relative flex h-[380px] flex-col justify-end gap-2 overflow-hidden rounded-xl bg-pine px-6 pb-7 pt-6 text-white">
          <span aria-hidden className="absolute left-[170px] top-[-40px] size-[200px] rounded-full bg-amber" />
          <span aria-hidden className="absolute left-[135px] top-[-55px] size-[170px] rounded-full bg-pine" />
          <span aria-hidden className="absolute inset-x-0 top-[200px] h-px bg-white/[.18]" />
          <p className="relative text-caption opacity-70">ROOM 701 · STANDARD DOUBLE</p>
          <h1 className="relative font-display text-display-l font-bold">하루를 쉬어가는<br />조용한 방 하나</h1>
          <p className="relative text-body-m opacity-[.82]">낮에는 대실, 밤에는 숙박.<br />단 하나의 방을 온전히 당신에게.</p>
        </div>
      </section>

      <section aria-label="객실 사진" className="flex gap-2 px-4 pt-3">
        {[0, 1].map((i) =>
          shown[i] ? (
            <div key={i} className="relative h-[84px] flex-1 overflow-hidden rounded-md">
              <Image src={shown[i].url} alt={`객실 사진 ${i + 1}`} fill sizes="120px" unoptimized loading="eager" className="object-cover" />
            </div>
          ) : (
            <div key={i} className={`flex h-[84px] flex-1 items-center justify-center rounded-md ${PLACEHOLDER_FILLS[i]}`}>
              <ImageIcon className="size-[22px]" strokeWidth={1.75} aria-hidden />
            </div>
          ),
        )}
        <div className="flex h-[84px] flex-1 flex-col items-center justify-center gap-1 rounded-md bg-inverse text-white">
          <span className="text-heading-m font-bold">+{more || 5}</span>
          <span className="text-caption opacity-70">사진 더보기</span>
        </div>
      </section>

      <section className="flex flex-col gap-1.5 px-5 pb-2 pt-6">
        <h2 className="text-heading-l font-bold">{room.name}</h2>
        <p className="text-body-m text-ink-2">최대 {room.capacity}인 · {room.bed} · {room.size_m2}㎡</p>
      </section>

      <section className="flex gap-3 px-5 pb-2 pt-4">
        <PriceCard kind="DAYUSE" icon={Sun} title="대실" lines={[`입실 ${hh(r.dayuse_first_start_hour)}~${hh(r.dayuse_last_start_hour)}`, `최대 ${r.dayuse_hours}시간 이용`]}
          price={r.dayuse_weekday_price} />
        <PriceCard kind="STAY" icon={Moon} title="숙박" lines={[`체크인 ${hh(r.stay_check_in_hour)}`, `체크아웃 익일 ${hh(r.stay_check_out_hour)}`]}
          price={r.stay_weekday_price} />
      </section>

      {room.amenities.length > 0 && (
        <section className="flex flex-col gap-3.5 px-5 pb-2 pt-6">
          <h2 className="text-heading-s font-bold">편의시설</h2>
          <ul className="flex justify-between">
            {room.amenities.map((a) => {
              const Icon = AMENITY_ICON[a] ?? Check;
              return (
                <li key={a} className="flex flex-col items-center gap-1.5">
                  <span className="flex size-[52px] items-center justify-center rounded-full border border-line bg-surface">
                    <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="text-caption text-ink-2">{a}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3.5 px-5 pb-8 pt-6">
        <h2 className="text-heading-s font-bold">이용 안내</h2>
        <dl className="divide-y divide-line rounded-lg border border-line bg-surface px-4 py-1">
          {guideRows(r).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-3.5 text-body-m">
              <dt className="text-ink-2">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="sticky bottom-0 mt-auto flex items-center gap-4 bg-surface px-5 pb-8 pt-3 shadow-sheet">
        <div className="flex flex-col text-caption text-ink-2">
          <span>대실 {r.dayuse_weekday_price.toLocaleString("ko-KR")}원~</span>
          <span>숙박 {r.stay_weekday_price.toLocaleString("ko-KR")}원~</span>
        </div>
        <Link href="/book?tab=dayuse"
          className="flex h-[52px] flex-1 items-center justify-center rounded-md bg-pine text-heading-s font-bold text-white hover:bg-pine-hover">
          날짜 선택하고 예약하기
        </Link>
      </div>
    </main>
  );
}

function PriceCard({ kind, icon: Icon, title, lines, price }: {
  kind: "DAYUSE" | "STAY"; icon: LucideIcon; title: string; lines: string[]; price: number;
}) {
  const tone = kind === "DAYUSE" ? "bg-amber-soft text-amber" : "bg-pine-soft text-pine";
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className={`flex size-9 items-center justify-center rounded-full ${tone}`}><Icon className="size-5" strokeWidth={1.75} aria-hidden /></span>
        <Badge kind={kind} />
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-heading-m font-bold">{title}</h3>
        <p className="text-caption text-ink-2">{lines[0]}<br />{lines[1]}</p>
      </div>
      <p className="flex items-baseline gap-0.5">
        <span className="text-number-l font-bold">{price.toLocaleString("ko-KR")}</span>
        <span className="text-body-m text-ink-2">원~</span>
      </p>
    </div>
  );
}
