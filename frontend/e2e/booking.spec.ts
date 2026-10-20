import { expect, test } from "@playwright/test";
import { DEMO, day, dayCell, monthParam, signup } from "./helpers";

test("guest books a day-use slot, sees it in KST, and cancels it", async ({ page }) => {
  await signup(page);
  await page.getByRole("link", { name: "날짜 선택하고 예약하기" }).click();
  await expect(page).toHaveURL(/\/book\?tab=dayuse/);
  const d = day(6);
  await page.goto(`/book?tab=dayuse&m=${monthParam(d)}`);
  await dayCell(page, d).click();
  await page.getByRole("button", { name: /^15:00/ }).click();
  await page.getByRole("link", { name: "예약 계속하기" }).click();

  await expect(page).toHaveURL(/\/checkout\?type=DAYUSE/);
  await page.getByText("예약 정보와 취소 규정을 확인했어요").click();
  await page.getByRole("button", { name: /결제하기$/ }).click();

  await expect(page).toHaveURL(/\/me\/reservations/);
  const card = page.getByRole("article").filter({ hasText: "15:00 ~ 19:00" }); // KST even though the browser is in LA
  await expect(card).toContainText("예약확정");
  await card.getByRole("button", { name: "예약 취소" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "취소하기" }).click();
  await expect(page.getByRole("article").filter({ hasText: "15:00 ~ 19:00" })).toContainText("취소됨");

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
  await page.waitForTimeout(500); // a late 401 refetch must not bounce us to /login
  await expect(page).toHaveURL(/\/$/);
});

test("checkout while logged out goes through login and comes back with the selection", async ({ page }) => {
  const target = `/checkout?type=DAYUSE&date=${day(7)}&hour=16`;
  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("이메일").fill(DEMO.email);
  await page.getByLabel("비밀번호").fill(DEMO.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(target);
  await expect(page.getByText("16:00 ~ 20:00 · 4시간 이용")).toBeVisible();
});

test("a 2-night stay closes the overlapping day-use slots on check-in day", async ({ page }) => {
  await signup(page);
  const checkIn = day(12);
  const checkOut = day(14);
  await page.goto(`/book?tab=stay&m=${monthParam(checkIn)}`);
  await dayCell(page, checkIn).click();
  if (monthParam(checkOut) !== monthParam(checkIn)) await page.getByRole("button", { name: "다음 달" }).click();
  await dayCell(page, checkOut).click();
  await expect(page.getByText("2박", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "예약 계속하기" }).click();
  await page.getByText("예약 정보와 취소 규정을 확인했어요").click();
  await page.getByRole("button", { name: /결제하기$/ }).click();
  await expect(page).toHaveURL(/\/me\/reservations/);

  await page.goto(`/book?tab=dayuse&date=${checkIn}`);
  await expect(page.getByRole("button", { name: /^10:00/ })).toBeEnabled();
  const closed = page.getByRole("button", { name: /^15:00/ });
  await expect(closed).toBeDisabled();
  await expect(closed).toContainText("마감");
});
