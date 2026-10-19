import { BrandMark } from "@/components/brand/BrandMark";

/** G6 (8:283) layout shared by login and signup. */
export function AuthShell({ children, footer }: { children: React.ReactNode; footer: string }) {
  return (
    <main className="flex flex-1 flex-col px-6 pb-10">
      <div className="flex flex-col items-center gap-2.5 pb-12 pt-[88px]">
        <BrandMark size={64} />
        <p className="font-display text-display-l font-bold">HARU</p>
        <p className="text-body-m text-ink-2">하루를 쉬어가는 방</p>
      </div>
      {children}
      <div className="flex-1" />
      <p className="pt-8 text-center text-caption text-ink-3">{footer}</p>
    </main>
  );
}
