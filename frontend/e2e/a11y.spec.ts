import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { HtmlValidate } from "html-validate/node";
import { ADMIN, DEMO, day, login } from "./helpers";

/**
 * Standards + accessibility gate for every screen: axe-core (WCAG 2.1 A/AA + best practices) on the live DOM and
 * html-validate on the rendered markup. Next.js framework-injected nodes are excluded from markup validation only.
 */
const htmlvalidate = new HtmlValidate({
  extends: ["html-validate:recommended"],
  rules: {
    // Pure formatting preferences (Next.js/React emit valid but differently-styled attributes).
    "no-inline-style": "off",
    "attribute-boolean-style": "off",
    "attribute-empty-style": "off",
    "void-style": "off",
    "no-trailing-whitespace": "off",
    "long-title": "off",
    // React 19 useId() emits ids like "_r_0_"; valid HTML5, only the strict "starts with a letter" style fails.
    "valid-id": ["error", { relaxed: true }],
  },
});

async function audit(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const violations = axe.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  const html = await page.evaluate(() => {
    // Next keeps previously visited routes mounted but hidden (React <Activity>); they are not exposed to users.
    document.querySelectorAll("body *").forEach((el) => {
      if (getComputedStyle(el).display === "none" && !el.closest("[data-audit-hidden]")) el.setAttribute("data-audit-hidden", "");
    });
    const doc = document.documentElement.cloneNode(true) as HTMLElement;
    document.querySelectorAll("[data-audit-hidden]").forEach((el) => el.removeAttribute("data-audit-hidden"));
    doc.querySelectorAll("script, nextjs-portal, next-route-announcer, template, [data-audit-hidden]").forEach((n) => n.remove());
    return `<!DOCTYPE html>${doc.outerHTML}`;
  });
  const report = await htmlvalidate.validateString(html, `${name}.html`);
  const markup = report.results.flatMap((r) => r.messages.map((m) => `${m.ruleId}: ${m.message} (${m.selector ?? ""})`));
  expect.soft(violations, `axe @ ${name}`).toEqual([]);
  expect.soft(markup, `html-validate @ ${name}`).toEqual([]);
}

test.describe("guest screens (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("public pages", async ({ page }) => {
    for (const [name, url] of [["home", "/"], ["login", "/login"], ["signup", "/signup"],
      ["book-dayuse", `/book?tab=dayuse&date=${day(4)}&hour=20`], ["book-stay", `/book?tab=stay&in=${day(29)}&out=${day(31)}`]] as const) {
      await page.goto(url);
      await audit(page, name);
    }
  });

  test("signed-in pages", async ({ page }) => {
    await login(page, DEMO, `/checkout?type=DAYUSE&date=${day(7)}&hour=11`);
    await audit(page, "checkout");
    await page.goto("/me/reservations");
    await audit(page, "my-reservations");
    await page.getByRole("button", { name: "예약 취소" }).first().click();
    await audit(page, "cancel-dialog");
  });
});

test.describe("admin screens (1440px)", () => {
  test("admin pages", async ({ page }) => {
    await login(page, ADMIN, "/admin");
    await audit(page, "admin-dashboard");
    for (const [name, url] of [["admin-reservations", "/admin/reservations?id=1"], ["admin-settings", "/admin/settings"], ["admin-room", "/admin/room"]] as const) {
      await page.goto(url);
      await audit(page, name);
    }
  });
});
