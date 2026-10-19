import { BrandMark } from "./BrandMark";

/** In-app splash (Figma "splash/iphone-1170x2532", node 18:24) shown while a route is loading. */
export function Splash() {
  return (
    <div role="status" aria-label="불러오는 중" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas">
      <div className="flex -translate-y-6 flex-col items-center gap-3 motion-safe:animate-[fade-in_400ms_ease-out]">
        <BrandMark size={100} />
        <p className="font-display text-[44px] font-bold leading-[54px] tracking-[-0.7px] text-ink">HARU</p>
        <p className="text-body-m text-ink-2">하루를 쉬어가는 방</p>
      </div>
      <p className="absolute bottom-16 text-caption text-ink-3">낮에는 대실, 밤에는 숙박</p>
    </div>
  );
}
