import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeApi, json } from "@/test/fakeApi";
import { ROOM } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { RoomScreen } from "./RoomScreen";

describe("RoomScreen", () => {
  it("keeps unsaved text edits when a photo is uploaded", async () => {
    let photos: { id: number; url: string }[] = [];
    fakeApi({
      "GET /api/room": () => json({ ...ROOM, photos }),
      "POST /api/admin/room/photos": () => { photos = [{ id: 1, url: "/uploads/a.png" }]; return json(photos[0], 201); },
    });
    renderWithProviders(<RoomScreen />);
    const desc = await screen.findByLabelText("설명");
    await userEvent.type(desc, "새 설명");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "a.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("사진 파일"), file);
    await waitFor(() => expect(screen.getByAltText("객실 사진 1")).toBeInTheDocument());
    expect(screen.getByLabelText("설명")).toHaveValue("새 설명");
    expect(screen.getByRole("button", { name: "변경사항 저장" })).toBeEnabled();
  });
});
