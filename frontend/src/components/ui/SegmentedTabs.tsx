import { cn } from "./cn";

type Item<T extends string> = { value: T; label: string };

/** Figma "Tab Item" (5:6) inside a bg-muted track. */
export function SegmentedTabs<T extends string>({ items, value, onChange, className, size = "l" }: {
  items: Item<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: "l" | "m";
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-md bg-muted p-1", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "flex-1 rounded-sm transition-colors",
              size === "l" ? "h-11" : "h-9 px-5",
              active ? "bg-surface text-heading-s font-bold text-ink shadow-card" : "text-body-m font-medium text-ink-2",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
