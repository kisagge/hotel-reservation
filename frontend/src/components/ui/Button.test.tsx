import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("is disabled and swallows clicks while loading", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>결제하기</Button>);
    const button = screen.getByRole("button", { name: /결제하기/ });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick normally", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>예약하기</Button>);
    await userEvent.click(screen.getByRole("button", { name: "예약하기" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
