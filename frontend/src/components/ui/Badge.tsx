import { cn } from "./cn";

export type BadgeKind = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "DAYUSE" | "STAY";

const STYLE: Record<BadgeKind, [string, string]> = {
  CONFIRMED: ["bg-success-soft text-success", "예약확정"],
  CANCELLED: ["bg-danger-soft text-danger", "취소됨"],
  COMPLETED: ["bg-muted text-ink-2", "이용완료"],
  DAYUSE: ["bg-amber-soft text-amber", "대실"],
  STAY: ["bg-pine-soft text-pine", "숙박"],
};

/** Figma "Badge" (4:127). */
export function Badge({ kind, className }: { kind: BadgeKind; className?: string }) {
  const [style, label] = STYLE[kind];
  return <span className={cn("inline-flex h-fit w-fit items-center rounded-full px-2 py-1 text-caption font-medium", style, className)}>{label}</span>;
}
