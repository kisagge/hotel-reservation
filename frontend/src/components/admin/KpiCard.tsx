import type { LucideIcon } from "lucide-react";

export function KpiCard({ icon: Icon, label, value, sub, tone = "text-pine" }: { icon: LucideIcon; label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-label font-medium text-ink-2">
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />{label}
      </div>
      <p className="text-number-xl font-bold">{value}</p>
      <p className={`text-caption ${tone}`}>{sub}</p>
    </div>
  );
}
