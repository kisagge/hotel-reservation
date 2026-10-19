import { describe, expect, it } from "vitest";
import { loginHref, safeNext } from "./authRedirect";

describe("safeNext (open-redirect guard)", () => {
  it("keeps internal paths with their query", () => {
    expect(safeNext("/checkout?type=DAYUSE&date=2026-10-23&hour=15")).toBe("/checkout?type=DAYUSE&date=2026-10-23&hour=15");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null])("rejects %s", (next) => {
    expect(safeNext(next)).toBe("/");
  });
});

describe("loginHref", () => {
  it("encodes the return path", () => {
    expect(loginHref("/me/reservations")).toBe("/login?next=%2Fme%2Freservations");
  });
});
