import { DashboardScreen } from "@/features/admin/DashboardScreen";

// Admin screens render after a client-side session check, so the server shell never contains them.
export const instant = false;
export const metadata = { title: "대시보드 · HARU 관리자" };

export default function AdminDashboardPage() {
  return <DashboardScreen />;
}
