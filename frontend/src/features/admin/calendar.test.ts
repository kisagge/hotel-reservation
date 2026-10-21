import { describe, expect, it } from "vitest";
import { dayChips, type TimelineItem } from "@/components/admin/timeline";
import { calendarFromSearch, calendarToSearch } from "./calendar";

const item = (o: Partial<TimelineItem>): TimelineItem => ({
  id: 1, type: "DAYUSE", start_at: "2026-10-23T10:00:00+09:00", end_at: "2026-10-23T14:00:00+09:00",
  blocked_until: "2026-10-23T15:00:00+09:00", guest_name: "이서연", block_reason: null, ...o,
});
const ITEMS = [
  item({}),
  item({ id: 2, type: "STAY", start_at: "2026-10-23T15:00:00+09:00", end_at: "2026-10-24T11:00:00+09:00",
    blocked_until: "2026-10-24T12:00:00+09:00", guest_name: "박준호" }),
  item({ id: 3, type: "BLOCK", start_at: "2026-10-27T00:00:00+09:00", end_at: "2026-10-29T00:00:00+09:00",
    blocked_until: "2026-10-29T00:00:00+09:00", guest_name: "", block_reason: "정기 점검" }),
  item({ id: 4, start_at: "2026-10-25T20:00:00+09:00", end_at: "2026-10-26T00:00:00+09:00", blocked_until: "2026-10-26T01:00:00+09:00" }),
];

describe("dayChips", () => {
  it("lists what occupies a day, with the part of the day it covers", () => {
    expect(dayChips(ITEMS, "2026-10-23")).toEqual([
      { id: 1, kind: "DAYUSE", time: "10:00", label: "이서연" },
      { id: 2, kind: "STAY", time: "15:00", label: "박준호" },
    ]);
    expect(dayChips(ITEMS, "2026-10-24")).toEqual([{ id: 2, kind: "STAY", time: "~11:00", label: "박준호" }]);
    expect(dayChips(ITEMS, "2026-10-27")).toEqual([{ id: 3, kind: "BLOCK", time: "종일", label: "정기 점검" }]);
    expect(dayChips(ITEMS, "2026-10-28")).toEqual([{ id: 3, kind: "BLOCK", time: "종일", label: "정기 점검" }]);
    expect(dayChips(ITEMS, "2026-10-29")).toEqual([]);
  });

  it("does not show a booking on the next day just because its cleaning buffer spills over", () => {
    expect(dayChips(ITEMS, "2026-10-25")).toHaveLength(1);
    expect(dayChips(ITEMS, "2026-10-26")).toEqual([]);
  });
});

describe("calendar URL state", () => {
  it("defaults to this month with today selected", () => {
    expect(calendarFromSearch(new URLSearchParams("view=calendar"), "2026-10-21")).toEqual({ month: "2026-10", day: "2026-10-21" });
  });

  it("selects nothing by default in another month, and drops days outside the month", () => {
    expect(calendarFromSearch(new URLSearchParams("m=2026-11"), "2026-10-21")).toEqual({ month: "2026-11", day: null });
    expect(calendarFromSearch(new URLSearchParams("m=2026-11&day=2026-10-05"), "2026-10-21")).toEqual({ month: "2026-11", day: null });
    expect(calendarFromSearch(new URLSearchParams("m=2026-13&day=2026-02-30"), "2026-10-21")).toEqual({ month: "2026-10", day: "2026-10-21" });
  });

  it("writes view, month and day", () => {
    expect(calendarToSearch({ month: "2026-11", day: "2026-11-03" }, 7)).toBe("view=calendar&m=2026-11&day=2026-11-03&id=7");
    expect(calendarToSearch({ month: "2026-11", day: null }, null)).toBe("view=calendar&m=2026-11");
  });
});
