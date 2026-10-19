"use client";

import { ScreenError } from "@/components/ui/ScreenError";

/** Route-level error boundary (render errors, e.g. a hand-edited URL the screen could not handle). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ScreenError onRetry={reset} />;
}
