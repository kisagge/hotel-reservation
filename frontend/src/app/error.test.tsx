import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

describe("route error boundary", () => {
  it("shows a recovery screen with retry", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("heading", { name: "화면을 불러오지 못했어요" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
  });
});
