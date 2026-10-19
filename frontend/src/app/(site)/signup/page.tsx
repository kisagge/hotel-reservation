import { Suspense } from "react";
import { AuthShell } from "@/features/auth/AuthShell";
import { SignupForm } from "@/features/auth/SignupForm";

export const metadata = { title: "회원가입 · HARU" };

export default function SignupPage() {
  return (
    <AuthShell footer="가입하면 대실·숙박 예약과 내 예약 관리를 할 수 있어요">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
