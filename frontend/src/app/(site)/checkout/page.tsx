import { Suspense } from "react";
import { Splash } from "@/components/brand/Splash";
import { CheckoutScreen } from "@/features/booking/CheckoutScreen";

export const metadata = { title: "예약 확인 · HARU" };

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Splash />}>
      <CheckoutScreen />
    </Suspense>
  );
}
