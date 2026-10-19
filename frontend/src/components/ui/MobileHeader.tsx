import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function MobileHeader({ title, back }: { title: string; back?: string }) {
  return (
    <header className="grid h-[52px] grid-cols-[24px_1fr_24px] items-center px-4">
      {back ? (
        <Link href={back} aria-label="뒤로"><ArrowLeft className="size-6" strokeWidth={1.75} /></Link>
      ) : <span />}
      <h1 className="text-center text-heading-m font-bold">{title}</h1>
      <span />
    </header>
  );
}
