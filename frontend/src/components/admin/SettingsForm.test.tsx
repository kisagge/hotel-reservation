import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ROOM } from "@/test/fixtures";
import { SettingsForm, validateSettings } from "./SettingsForm";

const setup = () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SettingsForm initial={ROOM.rules} onSave={onSave} saving={false} />);
  return { onSave, save: () => screen.getByRole("button", { name: "변경사항 저장" }) };
};

describe("validateSettings", () => {
  it("mirrors the backend rules", () => {
    expect(validateSettings(ROOM.rules)).toEqual({});
    expect(validateSettings({ ...ROOM.rules, stay_check_out_hour: 15 })).toHaveProperty("stay_check_out_hour", "체크아웃은 체크인보다 빨라야 해요");
    expect(validateSettings({ ...ROOM.rules, dayuse_first_start_hour: 21 })).toHaveProperty("dayuse_first_start_hour");
    expect(validateSettings({ ...ROOM.rules, stay_weekend_price: 0 })).toHaveProperty("stay_weekend_price", "0원보다 커야 해요");
  });
});

describe("SettingsForm", () => {
  it("keeps save disabled until something changes", () => {
    const { save } = setup();
    expect(save()).toBeDisabled();
  });

  it("blocks saving and explains an invalid check-out time", async () => {
    const { save } = setup();
    await userEvent.selectOptions(screen.getByLabelText("체크아웃 시각"), "15");
    expect(screen.getByText("체크아웃은 체크인보다 빨라야 해요")).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it("saves all twelve fields", async () => {
    const { onSave, save } = setup();
    const price = screen.getByLabelText("대실 평일 요금");
    await userEvent.clear(price);
    await userEvent.type(price, "40000");
    await userEvent.click(screen.getByRole("button", { name: "청소 시간 늘리기" }));
    expect(save()).toBeEnabled();
    await userEvent.click(save());
    const body = onSave.mock.calls[0][0];
    expect(Object.keys(body)).toHaveLength(12);
    expect(body).toMatchObject({ dayuse_weekday_price: 40000, cleaning_buffer_minutes: 90 });
  });

  it("revert restores the server values", async () => {
    const { save } = setup();
    await userEvent.click(screen.getByRole("button", { name: "최대 연박 늘리기" }));
    expect(screen.getByText("8박")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(screen.getByText("7박")).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });
});
