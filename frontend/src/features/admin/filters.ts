import { addDays, type YMD } from "@/lib/time";

export type AdminFilters = {
  q: string;
  type: "" | "DAYUSE" | "STAY";
  status: "" | "CONFIRMED" | "CANCELLED";
  from: YMD;
  to: YMD;
  page: number;
  id: number | null;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const monthStart = (today: YMD) => `${today.slice(0, 7)}-01`;
const monthEnd = (today: YMD) => {
  const [y, m] = today.split("-").map(Number);
  return addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
};
const posInt = (v: string | null) => (v && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null);

/** URL → filters for the admin list (A2). Unknown values fall back to defaults; default range = this KST month. */
export function filtersFromSearch(sp: URLSearchParams, today: YMD): AdminFilters {
  const type = sp.get("type");
  const status = sp.get("status");
  const from = sp.get("from");
  const to = sp.get("to");
  return {
    q: sp.get("q") ?? "",
    type: type === "DAYUSE" || type === "STAY" ? type : "",
    status: status === "CONFIRMED" || status === "CANCELLED" ? status : "",
    from: from && YMD_RE.test(from) ? from : monthStart(today),
    to: to && YMD_RE.test(to) ? to : monthEnd(today),
    page: posInt(sp.get("page")) ?? 1,
    id: posInt(sp.get("id")),
  };
}

export function filtersToSearch(f: AdminFilters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.type) sp.set("type", f.type);
  if (f.status) sp.set("status", f.status);
  sp.set("from", f.from);
  sp.set("to", f.to);
  if (f.page > 1) sp.set("page", String(f.page));
  if (f.id) sp.set("id", String(f.id));
  return sp.toString();
}
