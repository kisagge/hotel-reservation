import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

/** Figma "Input" (5:46): label, field (focus = pine, error = danger), help/error text. */
export function TextField({ label, help, error, className, id, type = "text", ...input }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; help?: string; error?: string;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  const noteId = `${fieldId}-note`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-label font-medium text-ink-2">{label}</label>
      <input
        id={fieldId}
        aria-invalid={!!error || undefined}
        type={type}
        aria-describedby={error || help ? noteId : undefined}
        className={cn(
          "h-12 rounded-md border bg-surface px-4 text-body-l text-ink outline-none placeholder:text-ink-3",
          error ? "border-[1.5px] border-danger" : "border-field focus:border-[1.5px] focus:border-pine",
        )}
        {...input}
      />
      {(error || help) && <p id={noteId} className={cn("text-caption", error ? "text-danger" : "text-ink-3")}>{error ?? help}</p>}
    </div>
  );
}
