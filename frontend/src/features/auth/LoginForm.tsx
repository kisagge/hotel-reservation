"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError, useLogin } from "@/lib/api/queries";
import { safeNext } from "@/lib/authRedirect";
import { errorMessage } from "@/lib/errors";

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => router.replace(next) });
  };
  const error = login.error instanceof ApiError ? errorMessage(login.error.code) : login.error ? errorMessage(null) : null;

  return (
    <form onSubmit={submit} className="flex flex-col">
      <div className="flex flex-col gap-4">
        <TextField label="이메일" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="비밀번호" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="pt-3 text-body-m text-danger">{error}</p>}
      <div className="flex flex-col gap-2 pt-4">
        <Button type="submit" loading={login.isPending}>로그인</Button>
        <Link href={`/signup?next=${encodeURIComponent(next)}`}
          className="flex h-[52px] items-center justify-center rounded-md text-heading-s font-bold text-pine hover:bg-pine-soft/50">
          처음이신가요? 회원가입
        </Link>
      </div>
    </form>
  );
}
