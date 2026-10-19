"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "./cn";

type Tone = "default" | "danger";
type ToastItem = { id: number; message: string; tone: Tone };
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, tone: Tone = "default") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} role="status"
            className={cn("max-w-sm rounded-md px-4 py-3 text-body-m font-medium text-white shadow-card", t.tone === "danger" ? "bg-danger" : "bg-inverse")}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
