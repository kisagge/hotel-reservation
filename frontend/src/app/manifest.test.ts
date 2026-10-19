import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("uses HARU branding with installable icons", () => {
    const m = manifest();
    expect(m.name).toBe("HARU · 하루를 쉬어가는 방");
    expect(m.short_name).toBe("HARU");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#f5f1ea");
    expect(m.theme_color).toBe("#2e4a3f");
    expect(m.icons?.map((i) => [i.src, i.sizes, i.purpose])).toEqual([
      ["/icons/icon-192.png", "192x192", "any"],
      ["/icons/icon-512.png", "512x512", "any"],
      ["/icons/maskable-512.png", "512x512", "maskable"],
    ]);
  });
});
