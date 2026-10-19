import { RoomScreen } from "@/features/admin/RoomScreen";

// Admin screens render after a client-side session check, so the server shell never contains them.
export const instant = false;
export const metadata = { title: "객실 정보 · HARU 관리자" };

export default function AdminRoomPage() {
  return <RoomScreen />;
}
