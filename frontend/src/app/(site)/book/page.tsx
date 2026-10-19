import { Suspense } from "react";
import { Splash } from "@/components/brand/Splash";
import { BookingScreen } from "@/features/booking/BookingScreen";

export const metadata = { title: "예약하기 · HARU" };

export default function BookPage() {
  return (
    <Suspense fallback={<Splash />}>
      <BookingScreen />
    </Suspense>
  );
}
