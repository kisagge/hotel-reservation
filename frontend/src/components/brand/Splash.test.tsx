import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Splash } from "./Splash";

describe("Splash", () => {
  it("shows the brand mark, name and tagline as a loading status", () => {
    render(<Splash />);
    const status = screen.getByRole("status", { name: "불러오는 중" });
    expect(status).toHaveTextContent("HARU");
    expect(status).toHaveTextContent("하루를 쉬어가는 방");
    expect(screen.getByTestId("brand-mark")).toBeInTheDocument();
  });
});
