import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Room } from "@/lib/api/queries";
import { HomeView } from "./HomeView";

const room: Room = {
  id: 1, name: "스탠다드 더블 · 701호", description: "", capacity: 2, bed: "퀸 베드", size_m2: 24,
  amenities: ["와이파이", "스마트TV", "욕조", "커피머신", "무료주차"], photos: [],
  rules: {
    dayuse_weekday_price: 35000, dayuse_weekend_price: 45000, stay_weekday_price: 79000, stay_weekend_price: 89000,
    dayuse_first_start_hour: 10, dayuse_last_start_hour: 20, dayuse_hours: 4, stay_check_in_hour: 15,
    stay_check_out_hour: 11, stay_max_nights: 7, cleaning_buffer_minutes: 60, guest_cancel_deadline_hours: 24,
  },
};

describe("HomeView", () => {
  it("shows prices and the usage guide from the API rules", () => {
    render(<HomeView room={room} loggedIn={false} />);
    expect(screen.getByText("35,000")).toBeInTheDocument();
    expect(screen.getByText("79,000")).toBeInTheDocument();
    expect(screen.getByText("체크인 15:00 · 체크아웃 11:00")).toBeInTheDocument();
    expect(screen.getByText("10:00 ~ 20:00 정시 입실")).toBeInTheDocument();
    expect(screen.getByText("퇴실 후 1시간은 예약 불가")).toBeInTheDocument();
    expect(screen.getByText("이용 24시간 전까지 무료 취소")).toBeInTheDocument();
    expect(screen.getByText("최대 2인 · 퀸 베드 · 24㎡")).toBeInTheDocument();
  });

  it("follows rule changes instead of hardcoding copy", () => {
    render(<HomeView room={{ ...room, rules: { ...room.rules, cleaning_buffer_minutes: 120, dayuse_hours: 3 } }} loggedIn={false} />);
    expect(screen.getByText("퇴실 후 2시간은 예약 불가")).toBeInTheDocument();
    expect(screen.getByText("입실 후 3시간")).toBeInTheDocument();
  });

  it("links to login when signed out and to my reservations when signed in", () => {
    const { rerender } = render(<HomeView room={room} loggedIn={false} />);
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
    rerender(<HomeView room={room} loggedIn />);
    expect(screen.getByRole("link", { name: "내 예약" })).toHaveAttribute("href", "/me/reservations");
  });

  it("starts booking from the CTA", () => {
    render(<HomeView room={room} loggedIn={false} />);
    expect(screen.getByRole("link", { name: "날짜 선택하고 예약하기" })).toHaveAttribute("href", "/book?tab=dayuse");
  });
});
