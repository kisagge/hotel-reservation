import { Suspense } from "react";
import { ReservationsScreen } from "@/features/admin/ReservationsScreen";

// Admin screens render after a client-side session check, so the server shell never contains them.
export const instant = false;
export const metadata = { title: "예약 관리 · HARU 관리자" };

export default function AdminReservationsPage() {
  return (
    <Suspense>
      <ReservationsScreen />
    </Suspense>
  );
}
