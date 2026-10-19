"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminFilters } from "@/features/admin/filters";
import { api } from "./client";
import { ApiError, qk, unwrap } from "./queries";
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


export const PAGE_SIZE = 20;

export function useAdminReservations(f: AdminFilters) {
  const query = {
    date_from: f.from, date_to: f.to, page: f.page, size: PAGE_SIZE,
    ...(f.type && { type: f.type }), ...(f.status && { status: f.status }), ...(f.q && { q: f.q }),
  };
  return useQuery({
    queryKey: adminKeys.reservations(JSON.stringify(query)),
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET("/api/admin/reservations", { params: { query } })),
  });
}

export function useAdminReservation(id: number | null) {
  return useQuery({
    queryKey: adminKeys.reservation(id ?? 0),
    enabled: !!id,
    queryFn: () => unwrap(api.GET("/api/admin/reservations/{reservation_id}", { params: { path: { reservation_id: id! } } })),
  });
}

export function useAdminCancel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.POST("/api/admin/reservations/{reservation_id}/cancel", { params: { path: { reservation_id: id } } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
      qc.invalidateQueries({ queryKey: qk.availability });
    },
  });
}

export type Settings = components["schemas"]["SettingsIn"];
export type RoomIn = components["schemas"]["RoomIn"];

export function useAdminSettings() {
  return useQuery({ queryKey: adminKeys.settings, queryFn: () => unwrap(api.GET("/api/admin/settings")) });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Settings) => unwrap(api.PUT("/api/admin/settings", { body })),
    onSuccess: (saved) => {
      qc.setQueryData(adminKeys.settings, saved);
      qc.invalidateQueries({ queryKey: qk.room });
      qc.invalidateQueries({ queryKey: qk.availability });
    },
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["BlockIn"]) => unwrap(api.POST("/api/admin/blocks", { body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
      qc.invalidateQueries({ queryKey: qk.availability });
    },
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE("/api/admin/blocks/{block_id}", { params: { path: { block_id: id } } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
      qc.invalidateQueries({ queryKey: qk.availability });
    },
  });
}

export function useSaveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RoomIn) => unwrap(api.PUT("/api/admin/room", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.room }),
  });
}

/** Multipart upload goes through plain fetch so the browser sets the boundary header. */
export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/room/photos", { method: "POST", body });
      if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).detail);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.room }),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE("/api/admin/room/photos/{photo_id}", { params: { path: { photo_id: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.room }),
  });
}
