import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "l" | "m";

const VARIANT: Record<Variant, string> = {
  primary: "bg-pine text-white hover:bg-pine-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-canvas",
  ghost: "text-pine hover:bg-pine-soft/50",
  danger: "bg-danger-soft text-danger hover:brightness-95",
};
const SIZE: Record<Size, string> = {
  l: "h-[52px] px-6 text-heading-s font-bold",
  m: "h-10 px-4 text-label font-medium",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

/** Figma "Button" (4:116). Disabled/loading renders the Disabled variant and blocks clicks. */
export function Button({ variant = "primary", size = "l", loading = false, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  const off = disabled || loading;
  return (
    <button
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md transition-colors",
        SIZE[size],
        off ? "cursor-not-allowed bg-disabled text-ink-disabled" : VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}
