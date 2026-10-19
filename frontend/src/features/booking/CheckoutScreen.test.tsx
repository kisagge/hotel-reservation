import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, json } from "@/test/fakeApi";
import { DAYUSE_QUOTE, ROOM, USER } from "@/test/fixtures";
import { renderWithProviders, testClient } from "@/test/render";
import { CheckoutScreen } from "./CheckoutScreen";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams("type=DAYUSE&date=2026-10-23&hour=15"),
  usePathname: () => "/checkout",
}));

const base = {
  "GET /api/auth/me": () => json(USER),
  "GET /api/room": () => json(ROOM),
  "POST /api/quotes": () => json(DAYUSE_QUOTE),
};

beforeEach(() => { push.mockReset(); replace.mockReset(); });

const payButton = () => screen.findByRole("button", { name: /35,000원 결제하기/ });

describe("CheckoutScreen", () => {
  it("prefills the guest and keeps pay disabled until the policy is agreed", async () => {
    fakeApi(base);
    renderWithProviders(<CheckoutScreen />);
    expect(await screen.findByDisplayValue("김하루")).toBeInTheDocument();
    expect(screen.getByText(/10월 22일 \(목\) 15:00까지 무료로 취소/)).toBeInTheDocument();
    const pay = await payButton();
    expect(pay).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /예약 정보와 취소 규정을 확인했어요/ }));
    expect(pay).toBeEnabled();
  });

  it("sends exactly one reservation request on a double click", async () => {
    let release!: () => void;
    const api = fakeApi({
      ...base,
      "POST /api/reservations": () => new Promise((r) => { release = () => r(json({ id: 7, code: "HR-1023-0007" }, 201)); }),
    });
    renderWithProviders(<CheckoutScreen />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /확인했어요/ }));
    const pay = await payButton();
    await userEvent.dblClick(pay);
    await userEvent.click(pay);
    expect(api.count("POST /api/reservations")).toBe(1);
    release();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/me/reservations?created=HR-1023-0007"));
    expect(pay).toBeDisabled(); // stays locked until the page leaves; a late tap must not re-post
    await userEvent.click(pay);
    expect(api.count("POST /api/reservations")).toBe(1);
  });

  it("on a 409 race shows the conflict message and routes back to booking", async () => {
    fakeApi({ ...base, "POST /api/reservations": () => json({ detail: "SLOT_UNAVAILABLE" }, 409) });
    renderWithProviders(<CheckoutScreen />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /확인했어요/ }));
    await userEvent.click(await payButton());
    expect(await screen.findByText(/방금 다른 예약이 들어왔어요/)).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/book?tab=dayuse&date=2026-10-23");
  });

  it("sends the user to login when the session expired", async () => {
    fakeApi({ ...base, "POST /api/reservations": () => json({ detail: "NOT_AUTHENTICATED" }, 401) });
    renderWithProviders(<CheckoutScreen />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /확인했어요/ }));
    await userEvent.click(await payButton());
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/login?next=%2Fcheckout%3Ftype%3DDAYUSE%26date%3D2026-10-23%26hour%3D15"));
  });

  it("redirects to login when the session cookie is invalid (me → 401)", async () => {
    fakeApi({ ...base, "GET /api/auth/me": () => json({ detail: "NOT_AUTHENTICATED" }, 401) });
    renderWithProviders(<CheckoutScreen />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fcheckout%3Ftype%3DDAYUSE%26date%3D2026-10-23%26hour%3D15"));
  });

  it("explains a quote the rules now reject instead of loading forever", async () => {
    fakeApi({ ...base, "POST /api/quotes": () => json({ detail: "START_HOUR_OUT_OF_RANGE" }, 422) });
    renderWithProviders(<CheckoutScreen />);
    expect(await screen.findByText("선택할 수 없는 시간이에요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 선택하기" })).toHaveAttribute("href", "/book?tab=dayuse&date=2026-10-23");
  });

  it("offers a retry when the server fails", async () => {
    fakeApi({ ...base, "GET /api/room": () => json({ detail: "boom" }, 500) });
    renderWithProviders(<CheckoutScreen />);
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("re-quotes on arrival even if a quote is cached, so the shown price is current", async () => {
    const api = fakeApi(base);
    const client = testClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 30_000 } }); // same freshness window as the app
    client.setQueryData(["availability", "quote", { type: "DAYUSE", date: "2026-10-23", start_hour: 15 }], { ...DAYUSE_QUOTE, total: 1 });
    renderWithProviders(<CheckoutScreen />, client);
    expect(await payButton()).toBeInTheDocument();
    expect(api.count("POST /api/quotes")).toBe(1);
  });
});
