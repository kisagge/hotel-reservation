import { SettingsScreen } from "@/features/admin/SettingsScreen";

// Admin screens render after a client-side session check, so the server shell never contains them.
export const instant = false;
export const metadata = { title: "요금·운영 설정 · HARU 관리자" };

export default function AdminSettingsPage() {
  return <SettingsScreen />;
}
