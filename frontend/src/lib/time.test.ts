import { describe, expect, it } from "vitest";
import { addDays, kstParts, monthGrid, todayKst, weekdayKst } from "./time";

describe("time (Asia/Seoul regardless of process TZ)", () => {
  it("todayKst crosses midnight in KST before UTC does", () => {
    expect(todayKst(new Date("2026-10-18T15:30:00Z"))).toBe("2026-10-19");
    expect(todayKst(new Date("2026-10-18T14:59:00Z"))).toBe("2026-10-18");
  });

  it("addDays handles month and year rollover", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("weekdayKst: 0 = Sunday", () => {
    expect(weekdayKst("2026-10-19")).toBe(1);
    expect(weekdayKst("2026-10-25")).toBe(0);
  });

  it("monthGrid starts on Sunday with null padding", () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(5);
    expect(g[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(g[4][6]).toBe("2026-10-31");
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });

  it("kstParts reads wall-clock KST from any offset", () => {
    expect(kstParts("2026-10-23T15:00:00+09:00")).toEqual({ ymd: "2026-10-23", hour: 15, minute: 0 });
    expect(kstParts("2026-10-23T06:00:00Z")).toEqual({ ymd: "2026-10-23", hour: 15, minute: 0 });
    expect(kstParts("2026-10-23T15:00:00Z")).toEqual({ ymd: "2026-10-24", hour: 0, minute: 0 });
  });
});
