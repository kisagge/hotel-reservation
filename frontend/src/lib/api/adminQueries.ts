"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { unwrap } from "./queries";
import type { components } from "./schema";

export type AdminReservation = components["schemas"]["AdminReservationOut"];
export type Dashboard = components["schemas"]["DashboardOut"];
export type Block = components["schemas"]["BlockOut"];

export const adminKeys = {
  all: ["admin"] as const,
  dashboard: ["admin", "dashboard"] as const,
  blocks: ["admin", "blocks"] as const,
  reservations: (search: string) => ["admin", "reservations", search] as const,
  reservation: (id: number) => ["admin", "reservation", id] as const,
  settings: ["admin", "settings"] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: () => unwrap(api.GET("/api/admin/dashboard")) });
}

export function useBlocks() {
  return useQuery({ queryKey: adminKeys.blocks, queryFn: () => unwrap(api.GET("/api/admin/blocks")) });
}
