import { cn } from "./cn";

type Slot = { start_hour: number; end_hour: number; available: boolean };
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Figma "Time Slot" (5:30) in a 4-column grid (G2). */
export function TimeSlotGrid({ slots, selected, onSelect }: { slots: Slot[]; selected: number | null; onSelect: (hour: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {slots.map((s) => {
        const isSel = s.start_hour === selected;
        return (
          <button
            key={s.start_hour}
            type="button"
            disabled={!s.available}
            aria-pressed={isSel}
            onClick={() => onSelect(s.start_hour)}
            className={cn(
              "flex h-14 flex-col items-center justify-center rounded-md transition-colors",
              !s.available ? "bg-muted text-ink-disabled" : isSel ? "bg-amber text-white" : "border border-line bg-surface text-ink hover:border-amber",
            )}
          >
            <span className={cn("text-heading-s font-bold", !s.available && "line-through")}>{hh(s.start_hour)}</span>
            <span className={cn("text-caption", isSel ? "text-white" : "text-ink-3")}>{s.available ? `~${hh(s.end_hour)}` : "마감"}</span>
          </button>
        );
      })}
    </div>
  );
}
