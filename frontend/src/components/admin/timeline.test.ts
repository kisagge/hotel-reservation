import { describe, expect, it } from "vitest";
import { timelineSegments } from "./timeline";

const item = (type: "STAY" | "DAYUSE" | "BLOCK", start: string, end: string, blocked: string, label = "") => ({
  id: 1, type, start_at: start, end_at: end, blocked_until: blocked, guest_name: label, block_reason: null,
});

describe("timelineSegments", () => {
  it("clips to the KST day and fills cleaning + free gaps", () => {
    const segs = timelineSegments([
      item("STAY", "2026-10-18T15:00:00+09:00", "2026-10-19T11:00:00+09:00", "2026-10-19T12:00:00+09:00", "김민수"),
      item("DAYUSE", "2026-10-19T12:00:00+09:00", "2026-10-19T16:00:00+09:00", "2026-10-19T17:00:00+09:00", "이서연"),
    ], "2026-10-19");
    expect(segs.map((s) => [s.kind, s.fromHour, s.toHour])).toEqual([
      ["STAY", 0, 11], ["CLEANING", 11, 12], ["DAYUSE", 12, 16], ["CLEANING", 16, 17], ["FREE", 17, 24],
    ]);
    expect(segs[0].label).toBe("김민수");
  });

  it("an empty day is one free segment", () => {
    expect(timelineSegments([], "2026-10-19")).toEqual([{ kind: "FREE", fromHour: 0, toHour: 24 }]);
  });

  it("a stay running past midnight is clipped at 24 and blocks keep their reason", () => {
    const segs = timelineSegments([
      { ...item("BLOCK", "2026-10-19T09:00:00+09:00", "2026-10-19T10:30:00+09:00", "2026-10-19T10:30:00+09:00"), block_reason: "점검" },
      item("STAY", "2026-10-19T15:00:00+09:00", "2026-10-20T11:00:00+09:00", "2026-10-20T12:00:00+09:00", "박준호"),
    ], "2026-10-19");
    expect(segs.map((s) => [s.kind, s.fromHour, s.toHour])).toEqual([
      ["FREE", 0, 9], ["BLOCK", 9, 10.5], ["FREE", 10.5, 15], ["STAY", 15, 24],
    ]);
    expect(segs[1].label).toBe("점검");
  });
});
