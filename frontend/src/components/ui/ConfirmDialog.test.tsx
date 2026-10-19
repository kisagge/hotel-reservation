import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

const setup = () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(<><button>바깥</button><ConfirmDialog open title="예약을 취소할까요?" confirmLabel="취소하기" tone="danger" onConfirm={onConfirm} onClose={onClose} /></>);
  return { onClose, onConfirm };
};

describe("ConfirmDialog accessibility", () => {
  it("is a labelled modal dialog that moves focus inside", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "예약을 취소할까요?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("keeps focus where it is when the parent re-renders", async () => {
    const props = { open: true, title: "예약을 취소할까요?", confirmLabel: "취소하기", onConfirm: vi.fn() } as const;
    const { rerender } = render(<ConfirmDialog {...props} onClose={() => {}} />);
    screen.getByRole("button", { name: "취소하기" }).focus();
    rerender(<ConfirmDialog {...props} loading onClose={() => {}} />); // new inline onClose identity, like real callers
    expect(screen.getByRole("button", { name: /취소하기/ })).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const { onClose } = setup();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps Tab focus inside the dialog", async () => {
    setup();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "취소하기" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "취소하기" })).toHaveFocus();
  });
});
