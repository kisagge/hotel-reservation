"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./schema";

export type User = components["schemas"]["UserOut"];
export type Room = components["schemas"]["RoomOut"];
export type Rules = Room["rules"];
export type Reservation = components["schemas"]["ReservationOut"];

export class ApiError extends Error {
  constructor(public status: number, public code: unknown) {
    super(typeof code === "string" ? code : `HTTP ${status}`);
  }
}

/** Resolve an openapi-fetch result to its data or throw ApiError(status, detail). */
export async function unwrap<T>(p: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await p;
  if (!response.ok) throw new ApiError(response.status, (error as { detail?: unknown } | undefined)?.detail);
  return data as T;
}

export const qk = {
  me: ["me"] as const,
  room: ["room"] as const,
  myReservations: ["reservations", "me"] as const,
  availability: ["availability"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async (): Promise<User | null> => {
      const res = await api.GET("/api/auth/me");
      if (res.response.status === 401) return null;
      return unwrap(Promise.resolve(res));
    },
  });
}

/** A new session must never see the previous account's cached data; only public room info survives. */
function startSession(qc: ReturnType<typeof useQueryClient>, user: User) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== qk.room[0] });
  qc.setQueryData(qk.me, user);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["LoginIn"]) => unwrap(api.POST("/api/auth/login", { body })),
    onSuccess: (user) => startSession(qc, user),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["SignupIn"]) => unwrap(api.POST("/api/auth/signup", { body })),
    onSuccess: (user) => startSession(qc, user),
  });
}

export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.status === 401;

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/auth/logout")),
    onSuccess: () => {
      qc.setQueryData(qk.me, null);
      qc.removeQueries({ queryKey: ["reservations"] });
    },
  });
}

export function useRoom() {
  return useQuery({ queryKey: qk.room, queryFn: () => unwrap(api.GET("/api/room")) });
}

export function useMyReservations() {
  return useQuery({ queryKey: qk.myReservations, queryFn: () => unwrap(api.GET("/api/reservations/me")) });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.POST("/api/reservations/{reservation_id}/cancel", { params: { path: { reservation_id: id } } })),
    // On failure too: a 409 (deadline passed, already cancelled elsewhere) means the list on screen is stale.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.myReservations });
      qc.invalidateQueries({ queryKey: qk.availability });
    },
  });
}
