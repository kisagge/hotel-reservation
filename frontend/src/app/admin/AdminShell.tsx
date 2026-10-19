"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Splash } from "@/components/brand/Splash";
import { Sidebar } from "@/components/admin/Sidebar";
import { useMe } from "@/lib/api/queries";
import { loginHref } from "@/lib/authRedirect";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (me.isSuccess && me.data === null) router.replace(loginHref(pathname));
  }, [me.isSuccess, me.data, pathname, router]);

  if (!me.data) return <Splash />;
  if (me.data.role !== "ADMIN")
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas text-center">
        <p className="font-display text-display-m font-bold">접근 권한이 없어요</p>
        <p className="text-body-m text-ink-2">관리자 계정으로 로그인해 주세요.</p>
        <Link href="/" className="rounded-md bg-pine px-6 py-3 text-heading-s font-bold text-white">홈으로</Link>
      </main>
    );
  return (
    <div className="flex min-h-dvh min-w-[1200px] bg-canvas">
      <Sidebar user={me.data} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-10 pb-10 pt-9">{children}</main>
    </div>
  );
}
