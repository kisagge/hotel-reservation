import { cn } from "./cn";

/** Sticky summary/CTA sheet at the bottom of mobile screens (G1/G2/G4). */
export function BottomSheet({ children, className, rounded = true }: { children: React.ReactNode; className?: string; rounded?: boolean }) {
  return (
    <div className={cn("sticky bottom-0 z-10 bg-surface px-5 pb-8 pt-3 shadow-sheet", rounded && "rounded-t-xl pt-5", className)}>
      {children}
    </div>
  );
}
