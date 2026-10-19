import { Minus, Plus } from "lucide-react";

/** A3 stepper: [−] value [+] with min/max clamping. */
export function Stepper({ label, value, display, step = 1, min, max, onChange }: {
  label: string; value: number; display: string; step?: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex h-11 items-center overflow-hidden rounded-md border border-line-strong bg-surface">
      <button type="button" aria-label={`${label} 줄이기`} disabled={value - step < min} onClick={() => onChange(value - step)}
        className="flex h-full w-10 items-center justify-center bg-canvas text-ink-2 disabled:text-ink-disabled">
        <Minus className="size-4" strokeWidth={2} />
      </button>
      <span className="w-[88px] text-center text-heading-s font-bold" aria-live="polite">{display}</span>
      <button type="button" aria-label={`${label} 늘리기`} disabled={value + step > max} onClick={() => onChange(value + step)}
        className="flex h-full w-10 items-center justify-center bg-canvas text-ink-2 disabled:text-ink-disabled">
        <Plus className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}
