import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HARU · 하루를 쉬어가는 방",
    short_name: "HARU",
    description: "낮에는 대실, 밤에는 숙박. 단 하나의 방을 온전히.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1ea",
    theme_color: "#2e4a3f",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
