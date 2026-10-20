import { expect, test } from "@playwright/test";

test("pages ship security headers and the app still runs under the CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  await expect(page.getByText("이용 안내")).toBeVisible();
  expect(violations).toEqual([]);
});

test("API responses through the proxy keep backend security headers", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});
