"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export default function Page() {
  const { data } = useQuery({ queryKey: ["room"], queryFn: async () => (await api.GET("/api/room")).data });
  return <h1 className="p-8 font-display text-display-l text-pine">{data?.name ?? "…"}</h1>;
}
