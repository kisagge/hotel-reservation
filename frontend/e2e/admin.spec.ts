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

  await page.goto("/admin/reservations");
  await page.getByRole("button", { name: "캘린더" }).click();
  if (monthParam(from) !== monthParam(day(0))) await page.getByRole("button", { name: "다음 달" }).click();
  const cell = page.getByRole("table").getByRole("button", { name: new RegExp(`^${Number(from.slice(8))}, `) });
  await expect(cell).toHaveAccessibleName(/차단 1건/);
  await cell.click();
  await expect(page.getByRole("list", { name: "이날 일정" })).toContainText("차단 · E2E 점검");

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

test("admin books a walk-in guest, then moves the booking", async ({ page }) => {
  await login(page, ADMIN, "/admin/reservations");
  const d = day(16);
  await page.getByRole("button", { name: "예약 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "예약 추가" });
  await dialog.getByLabel("날짜").fill(d);
  await dialog.getByLabel("입실 시간").selectOption("10");
  await dialog.getByLabel("예약자 이름").fill("현장손님");
  await dialog.getByLabel("연락처").fill("010-2222-3333");
  await dialog.getByRole("button", { name: "예약 만들기" }).click();
  await expect(page.getByText(/^예약을 추가했어요/)).toBeVisible();
  const detail = page.getByRole("complementary", { name: "예약 상세" });
  await expect(detail).toContainText("현장손님");
  await expect(detail).toContainText("10:00 – 14:00");

  await detail.getByRole("button", { name: "일정 변경" }).click();
  const move = page.getByRole("dialog", { name: "일정 변경" });
  await move.getByLabel("입실 시간").selectOption("14");
  await move.getByRole("button", { name: "일정 변경하기" }).click();
  await expect(page.getByText(/^일정을 변경했어요/)).toBeVisible();
  await expect(detail).toContainText("14:00 – 18:00");
});
