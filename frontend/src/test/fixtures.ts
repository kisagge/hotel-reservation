import type { Room, User } from "@/lib/api/queries";

export const USER: User = { id: 1, email: "haru@example.com", name: "김하루", phone: "010-1234-5678", role: "USER" };

export const ROOM: Room = {
  id: 1, name: "스탠다드 더블 · 701호", description: "", capacity: 2, bed: "퀸 베드", size_m2: 24, amenities: [], photos: [],
  rules: {
    dayuse_weekday_price: 35000, dayuse_weekend_price: 45000, stay_weekday_price: 79000, stay_weekend_price: 89000,
    dayuse_first_start_hour: 10, dayuse_last_start_hour: 20, dayuse_hours: 4, stay_check_in_hour: 15,
    stay_check_out_hour: 11, stay_max_nights: 7, cleaning_buffer_minutes: 60, guest_cancel_deadline_hours: 24,
  },
};

export const DAYUSE_QUOTE = {
  type: "DAYUSE", start_at: "2026-10-23T15:00:00+09:00", end_at: "2026-10-23T19:00:00+09:00", nights: null,
  lines: [{ label: "대실 · 평일 4시간", amount: 35000 }], total: 35000, available: true, reason: null,
};
