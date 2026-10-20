import { describe, expect, it } from "vitest";
import { filtersFromSearch, filtersToSearch, type AdminFilters } from "./filters";

describe("admin reservation filters ⇄ URL", () => {
  it("defaults to this KST month, page 1, nothing selected", () => {
    expect(filtersFromSearch(new URLSearchParams(""), "2026-10-19")).toEqual({
      q: "", type: "", status: "", from: "2026-10-01", to: "2026-10-31", page: 1, id: null,
    });
  });

  it("round-trips through the query string", () => {
    const f: AdminFilters = { q: "김하루", type: "STAY", status: "CONFIRMED", from: "2026-11-01", to: "2026-11-30", page: 3, id: 12 };
    expect(filtersFromSearch(new URLSearchParams(filtersToSearch(f)), "2026-10-19")).toEqual(f);
  });

  it("drops empty values from the URL", () => {
    const qs = filtersToSearch({ q: "", type: "", status: "", from: "2026-10-01", to: "2026-10-31", page: 1, id: null });
    expect(qs).toBe("from=2026-10-01&to=2026-10-31");
  });

  it("ignores garbage values", () => {
    const f = filtersFromSearch(new URLSearchParams("type=BLOCK&status=NOPE&page=-2&id=abc&from=bad&to=2026-99-99"), "2026-10-19");
    expect(f.to).toBe("2026-10-31");
    expect(f).toMatchObject({ type: "", status: "", page: 1, id: null, from: "2026-10-01" });
  });
});
