"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk, unwrap } from "@/lib/api/queries";
import type { components } from "@/lib/api/schema";
import type { YMD } from "@/lib/time";

export type QuoteIn = components["schemas"]["DayUseQuoteIn"] | components["schemas"]["StayQuoteIn"];
export type Quote = components["schemas"]["QuoteOut"];

export function useDayuseSlots(date: YMD | null) {
  return useQuery({
    queryKey: [...qk.availability, "dayuse", date],
    enabled: !!date,
    queryFn: () => unwrap(api.GET("/api/availability/dayuse", { params: { query: { date: date! } } })),
  });
}

export function useStayDays(month: string) {
  return useQuery({
    queryKey: [...qk.availability, "stay", month],
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET("/api/availability/stay", { params: { query: { month } } })),
  });
}

/** Server-side price + availability for an exact selection; the single source of truth before checkout. */
export function useQuote(q: QuoteIn | null, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [...qk.availability, "quote", q],
    enabled: !!q,
    // checkout must show the price that will actually be charged, never a cached one
    ...(fresh && { staleTime: 0, refetchOnMount: "always" as const }),
    queryFn: () => unwrap(api.POST("/api/quotes", { body: q! })),
  });
}

export function checkoutHref(q: QuoteIn): string {
  return q.type === "DAYUSE"
    ? `/checkout?type=DAYUSE&date=${q.date}&hour=${q.start_hour}`
    : `/checkout?type=STAY&in=${q.check_in}&nights=${q.nights}`;
}
