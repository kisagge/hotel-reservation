import { Suspense } from "react";
import { Splash } from "@/components/brand/Splash";
import { MyReservationsScreen } from "@/features/reservations/MyReservationsScreen";

export const metadata = { title: "내 예약 · HARU" };

export default function MyReservationsPage() {
  return (
    <Suspense fallback={<Splash />}>
      <MyReservationsScreen />
    </Suspense>
  );
}
