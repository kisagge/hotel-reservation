import { expect, type Page } from "@playwright/test";
import { formatDateKo } from "../src/lib/format";
import { addDays, todayKst, weekdayKst, type YMD } from "../src/lib/time";

export const DEMO = { email: "haru@example.com", password: "haru1234" };
export const ADMIN = { email: "admin@haru.dev", password: "admin1234" };

/** KST date n days from today — the same clock the UI uses, regardless of the browser timezone. */
export const day = (n: number): YMD => addDays(todayKst(), n);
export const monthParam = (d: YMD) => d.slice(0, 7);
export const firstWeekdayFrom = (n: number): YMD => {
  let d = day(n);
  while ([0, 6].includes(weekdayKst(d))) d = addDays(d, 1);
  return d;
};

export async function signup(page: Page) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("이름").fill("테스트");
  await page.getByLabel("연락처").fill("010-5555-0000");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL("/");
  return email;
}

export async function login(page: Page, who: { email: string; password: string }, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("이메일").fill(who.email);
  await page.getByLabel("비밀번호").fill(who.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(next);
}

/** Calendar cell for a KST date (opens the right month via the `m` URL param on the booking page). */
export const dayCell = (page: Page, d: YMD) => page.getByRole("gridcell", { name: new RegExp(`^${formatDateKo(d).replace(/[()]/g, "\\$&")}`) });
