import { test } from "@playwright/test";
import { ADMIN, DEMO, day, login, monthParam } from "./helpers";

// README screenshots from the production build: `SCREENSHOTS=1 npm run e2e -- screenshots`
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to refresh docs/screenshots");

test("capture README screenshots", async ({ page }) => {
  const out = (name: string) => `../docs/screenshots/${name}.png`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText("이용 안내").waitFor();
  await page.screenshot({ path: out("home") });
  await login(page, DEMO, `/book?tab=dayuse&date=${day(4)}&hour=20`);
  await page.getByText("20:00 ~ 24:00 (4시간)").waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out("booking") });
  await page.goto("/me/reservations");
  await page.getByText("이용 예정").waitFor();
  await page.screenshot({ path: out("my-reservations") });
  await page.context().clearCookies();
  await page.setViewportSize({ width: 1440, height: 1024 });
  await login(page, ADMIN, "/admin");
  await page.getByText("오늘의 객실 타임라인").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out("admin-dashboard") });
  await page.goto(`/admin/reservations?view=calendar&m=${monthParam(day(4))}&day=${day(4)}`);
  await page.getByRole("list", { name: "이날 일정" }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out("admin-calendar") });
});
