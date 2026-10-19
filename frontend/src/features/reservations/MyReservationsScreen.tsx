"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Splash } from "@/components/brand/Splash";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { useToast } from "@/components/ui/Toast";
import { ApiError, useCancelReservation, useMyReservations, type Reservation } from "@/lib/api/queries";
import { errorMessage } from "@/lib/errors";
import { formatRange } from "@/lib/format";
import { ReservationCard } from "./ReservationCard";

/** G5 · 내 예약 (Figma 8:201). */
export function MyReservationsScreen() {
  const list = useMyReservations();
  const cancel = useCancelReservation();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const created = useSearchParams().get("created");
  const announced = useRef(false);
  const [target, setTarget] = useState<Reservation | null>(null);

  useEffect(() => {
    if (!created || announced.current) return;
    announced.current = true;
    toast(`예약이 확정됐어요 · ${created}`);
    router.replace(pathname, { scroll: false });
  }, [created, pathname, router, toast]);

  if (!list.data) return <Splash />;
  const upcoming = list.data.filter((r) => r.display_status === "CONFIRMED").sort((a, b) => a.start_at.localeCompare(b.start_at));
  const past = list.data.filter((r) => r.display_status !== "CONFIRMED").sort((a, b) => b.start_at.localeCompare(a.start_at));

  const confirmCancel = () => {
    if (!target) return;
    cancel.mutate(target.id, {
      onSuccess: () => toast("예약을 취소했어요"),
      onError: (e) => toast(errorMessage(e instanceof ApiError ? e.code : null), "danger"),
      onSettled: () => setTarget(null),
    });
  };

  return (
    <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
      <MobileHeader title="내 예약" back="/" />
      {list.data.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-24 text-center">
          <p className="text-heading-m font-bold">아직 예약이 없어요</p>
          <p className="text-body-m text-ink-2">낮에는 대실, 밤에는 숙박으로 하루를 쉬어가세요.</p>
          <Link href="/book?tab=dayuse" className="flex h-[52px] items-center rounded-md bg-pine px-6 text-heading-s font-bold text-white">
            예약하러 가기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-7 px-4 pb-10 pt-2">
          <Section title={`이용 예정 ${upcoming.length}`} items={upcoming} onCancel={setTarget} empty="예정된 예약이 없어요" />
          {past.length > 0 && <Section title="지난 예약" items={past} onCancel={setTarget} />}
        </div>
      )}
      <ConfirmDialog open={!!target} tone="danger" title="예약을 취소할까요?" confirmLabel="취소하기" loading={cancel.isPending}
        body={target ? `${formatRange(target.start_at, target.end_at)} 예약을 취소하고 결제 금액을 환불해요.` : undefined}
        onConfirm={confirmCancel} onClose={() => setTarget(null)} />
    </main>
  );
}

function Section({ title, items, onCancel, empty }: { title: string; items: Reservation[]; onCancel: (r: Reservation) => void; empty?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-heading-s font-bold">{title}</h2>
      {items.length === 0 && empty && <p className="rounded-lg bg-surface px-4 py-6 text-center text-body-m text-ink-3">{empty}</p>}
      {items.map((r) => <ReservationCard key={r.id} r={r} onCancel={onCancel} />)}
    </section>
  );
}
