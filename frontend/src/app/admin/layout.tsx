import { Suspense } from "react";
import { Splash } from "@/components/brand/Splash";
import { AdminShell } from "./AdminShell";

export const metadata = { title: "HARU 관리자" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<Splash />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
