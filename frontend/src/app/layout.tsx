import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-sans-kr", weight: ["400", "500", "700"], subsets: ["latin"] });
const gowunBatang = Gowun_Batang({ variable: "--font-gowun-batang", weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HARU · 하루를 쉬어가는 방",
  description: "낮에는 대실, 밤에는 숙박. 단 하나의 방을 온전히.",
  applicationName: "HARU",
  appleWebApp: {
    capable: true,
    title: "HARU",
    statusBarStyle: "default",
    startupImage: [
      {
        url: "/splash/iphone-1170x2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
    ],
  },
};

export const viewport: Viewport = { themeColor: "#2e4a3f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${gowunBatang.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
