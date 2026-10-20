import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function MobileHeader({ title, back, action }: { title: string; back?: string; action?: React.ReactNode }) {
  return (
    <header className="grid h-[52px] grid-cols-[44px_1fr_44px] items-center px-2">
      {back ? (
        <Link href={back} aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md"><ArrowLeft className="size-6" strokeWidth={1.75} aria-hidden /></Link>
      ) : <span />}
      <h1 className="text-center text-heading-m font-bold">{title}</h1>
      {action ?? <span />}
    </header>
  );
}
