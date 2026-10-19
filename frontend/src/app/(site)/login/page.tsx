import { Suspense } from "react";
import { AuthShell } from "@/features/auth/AuthShell";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata = { title: "로그인 · HARU" };

export default function LoginPage() {
  return (
    <AuthShell footer="예약하려면 로그인이 필요해요">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
