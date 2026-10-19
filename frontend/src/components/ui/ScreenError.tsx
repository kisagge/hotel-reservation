"use client";

import Link from "next/link";
import { Button } from "./Button";

/** Recovery screen for failed loads: never leave the user on an endless splash. */
export function ScreenError({ title = "화면을 불러오지 못했어요", message = "잠시 후 다시 시도해 주세요", onRetry, children }: {
  title?: string; message?: string; onRetry?: () => void; children?: React.ReactNode;
}) {
  return (
    <main id="main" tabIndex={-1} role="alert" className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <h1 className="text-heading-l font-bold">{title}</h1>
      <p className="text-body-m text-ink-2">{message}</p>
      <div className="flex gap-2 pt-3">
        {children}
        {onRetry && <Button size="m" onClick={onRetry}>다시 시도</Button>}
        <Link href="/" className="flex h-10 items-center rounded-md border border-field bg-surface px-4 text-label font-medium">홈으로</Link>
      </div>
    </main>
  );
}
