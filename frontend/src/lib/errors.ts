const MESSAGES: Record<string, string> = {
  SLOT_UNAVAILABLE: "방금 다른 예약이 들어왔어요. 다른 시간을 선택해 주세요",
  IN_THE_PAST: "이미 지난 시간이에요",
  CANCEL_DEADLINE_PASSED: "취소 가능 시간이 지났어요",
  ALREADY_CANCELLED: "이미 취소된 예약이에요",
  EMAIL_TAKEN: "이미 가입된 이메일이에요",
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 맞지 않아요",
  BLOCK_OVERLAPS_RESERVATION: "이 기간에 이미 예약이 있어요",
  NOT_AUTHENTICATED: "로그인이 필요해요",
  FORBIDDEN: "접근 권한이 없어요",
  START_HOUR_OUT_OF_RANGE: "선택할 수 없는 시간이에요",
  NIGHTS_OUT_OF_RANGE: "숙박 가능 기간을 넘었어요",
  SERVICE_BUSY: "지금 예약 요청이 많아요. 잠시 후 다시 시도해 주세요",
  DATE_OUT_OF_RANGE: "선택할 수 없는 날짜예요",
};

export const FALLBACK_MESSAGE = "잠시 후 다시 시도해 주세요";

/** Korean message for an API `detail` code; anything unrecognized gets the generic fallback. */
export function errorMessage(code: unknown): string {
  return (typeof code === "string" && MESSAGES[code]) || FALLBACK_MESSAGE;
}
