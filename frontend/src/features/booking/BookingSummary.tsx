import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/errors";
import type { Quote } from "./useAvailability";

/** Bottom "Summary Sheet" of G2/G3. */
export function BookingSummary({ caption, title, quote, loading, href, hint }: {
  caption?: string; title?: string; quote?: Quote; loading: boolean; href: string | null; hint: string;
}) {
  const blocked = quote && !quote.available;
  return (
    <div className="sticky bottom-0 mt-auto flex flex-col gap-4 rounded-t-xl bg-surface px-5 pb-8 pt-5 shadow-sheet">
      {quote && caption ? (
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-2">{caption}</span>
            <span className="text-heading-s font-bold">{title}</span>
          </div>
          <p className="flex items-baseline gap-0.5">
            <span className="text-number-l font-bold">{quote.total.toLocaleString("ko-KR")}</span>
            <span className="text-body-m text-ink-2">원</span>
          </p>
        </div>
      ) : (
        <p className="text-body-m text-ink-2">{hint}</p>
      )}
      {blocked && <p role="alert" className="-mt-2 text-body-m text-danger">{errorMessage(quote.reason)}</p>}
      {href && quote?.available ? (
        <Link href={href} className="flex h-[52px] items-center justify-center rounded-md bg-pine text-heading-s font-bold text-white hover:bg-pine-hover">
          예약 계속하기
        </Link>
      ) : (
        <Button disabled loading={loading}>예약 계속하기</Button>
      )}
    </div>
  );
}
