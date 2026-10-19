import { expect, test } from "@playwright/test";
import { ADMIN, DEMO, day, dayCell, firstWeekdayFrom, login, monthParam } from "./helpers";

test("admin sees the dashboard", async ({ page }) => {
  await login(page, ADMIN, "/admin");
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
  await expect(page.getByText("오늘 체크인")).toBeVisible();
  await expect(page.getByText("오늘의 객실 타임라인")).toBeVisible();
});

test("a block added in settings closes those stay days for guests", async ({ page }) => {
  await login(page, ADMIN, "/admin/settings");
  const from = day(21);
  const to = day(23);
  await page.getByRole("button", { name: "+ 차단 일정 추가" }).click();
  await page.getByLabel("시작 일시").fill(`${from}T00:00`);
  await page.getByLabel("종료 일시").fill(`${to}T00:00`);
  await page.getByLabel("사유").fill("E2E 점검");
  await page.getByRole("button", { name: "추가하기" }).click();
  await expect(page.locator("#blocks")).toContainText("E2E 점검");

  await page.goto(`/book?tab=stay&m=${monthParam(from)}`);
  await expect(dayCell(page, from)).toHaveAccessibleName(/예약 마감/);
});

test("changing the weekday day-use price shows up in the guest quote", async ({ page }) => {
  await login(page, ADMIN, "/admin/settings");
  const price = page.getByLabel("대실 평일 요금");
  await price.fill("40000");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("저장했어요 · 새 예약부터 적용돼요")).toBeVisible();

  const d = firstWeekdayFrom(25);
  await page.goto(`/book?tab=dayuse&date=${d}&hour=10`);
  await expect(page.getByText("40,000", { exact: true })).toBeVisible();
});

test("a regular user cannot open the admin", async ({ page }) => {
  await login(page, DEMO, "/");
  await page.goto("/admin");
  await expect(page.getByText("접근 권한이 없어요")).toBeVisible();
});
