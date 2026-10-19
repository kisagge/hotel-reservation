import { describe, expect, it } from "vitest";
import { loginHref, safeNext } from "./authRedirect";

describe("safeNext (open-redirect guard)", () => {
  it("keeps internal paths with their query", () => {
    expect(safeNext("/checkout?type=DAYUSE&date=2026-10-23&hour=15")).toBe("/checkout?type=DAYUSE&date=2026-10-23&hour=15");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r//evil.com", "/.//evil.com", "/a/..//evil.com", "javascript:alert(1)", "", null])("rejects %j", (next) => {
    expect(safeNext(next)).toBe("/");
  });
});

it("re-serializes so only same-origin path, query and hash survive", () => {
  expect(safeNext("/book?tab=stay#cal")).toBe("/book?tab=stay#cal");
});

describe("loginHref", () => {
  it("encodes the return path", () => {
    expect(loginHref("/me/reservations")).toBe("/login?next=%2Fme%2Freservations");
  });
});
