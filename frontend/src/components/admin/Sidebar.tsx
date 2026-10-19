"use client";

import { Ban, BedDouble, LayoutGrid, List, LogOut, SlidersHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { useLogout, type User } from "@/lib/api/queries";

const NAV: [string, string, LucideIcon][] = [
  ["/admin", "대시보드", LayoutGrid],
  ["/admin/reservations", "예약 관리", List],
  ["/admin/room", "객실 정보", BedDouble],
  ["/admin/settings", "요금·운영 설정", SlidersHorizontal],
  ["/admin/settings#blocks", "차단 일정", Ban],
];

/** Figma "Nav Item" (5:61) list in the 248px admin sidebar. */
export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  return (
    <aside className="sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col gap-1 border-r border-line bg-surface px-4 pb-6 pt-7">
      <Link href="/admin" className="flex items-center gap-2 px-3 pb-7">
        <span className="font-display text-display-s font-bold">HARU</span>
        <span className="rounded-sm bg-inverse px-1.5 py-0.5 text-caption text-white">ADMIN</span>
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV.map(([href, label, Icon]) => {
          const active = !href.includes("#") && (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-md px-4 py-3",
                active ? "bg-pine text-heading-s font-bold text-white" : "text-body-m font-medium text-ink-2 hover:bg-canvas")}>
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-2.5 rounded-md bg-canvas p-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-pine-soft text-label font-medium text-pine">{user.name.slice(0, 1)}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-m font-medium">{user.name}</span>
          <span className="truncate text-caption text-ink-3">{user.email}</span>
        </div>
        <button type="button" aria-label="로그아웃" onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
          className="text-ink-3 hover:text-ink">
          <LogOut className="size-[18px]" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
