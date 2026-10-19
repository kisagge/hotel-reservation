import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("maps known API codes", () => {
    expect(errorMessage("SLOT_UNAVAILABLE")).toBe("방금 다른 예약이 들어왔어요. 다른 시간을 선택해 주세요");
    expect(errorMessage("INVALID_CREDENTIALS")).toBe("이메일 또는 비밀번호가 맞지 않아요");
  });

  it("falls back for unknown or non-string codes", () => {
    expect(errorMessage("NOPE")).toBe("잠시 후 다시 시도해 주세요");
    expect(errorMessage(undefined)).toBe("잠시 후 다시 시도해 주세요");
    expect(errorMessage([{ msg: "validation" }])).toBe("잠시 후 다시 시도해 주세요");
  });
});
