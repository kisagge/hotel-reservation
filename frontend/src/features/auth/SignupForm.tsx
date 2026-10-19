"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError, useSignup } from "@/lib/api/queries";
import { safeNext } from "@/lib/authRedirect";
import { errorMessage } from "@/lib/errors";

export function SignupForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const signup = useSignup();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    signup.mutate(form, { onSuccess: () => router.replace(next) });
  };
  const err = signup.error;
  const error = err instanceof ApiError
    ? err.status === 422 ? "입력한 내용을 다시 확인해 주세요" : errorMessage(err.code)
    : err ? errorMessage(null) : null;

  return (
    <form onSubmit={submit} className="flex flex-col">
      <div className="flex flex-col gap-4">
        <TextField label="이름" autoComplete="name" required maxLength={30} value={form.name} onChange={set("name")} />
        <TextField label="연락처" type="tel" autoComplete="tel" required minLength={9} maxLength={20} placeholder="010-1234-5678"
          help="입실 안내 문자를 보내드려요" value={form.phone} onChange={set("phone")} />
        <TextField label="이메일" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
        <TextField label="비밀번호" type="password" autoComplete="new-password" required minLength={8} help="8자 이상"
          value={form.password} onChange={set("password")} />
      </div>
      {error && <p role="alert" className="pt-3 text-body-m text-danger">{error}</p>}
      <div className="flex flex-col gap-2 pt-4">
        <Button type="submit" loading={signup.isPending}>가입하고 시작하기</Button>
        <Link href={`/login?next=${encodeURIComponent(next)}`}
          className="flex h-[52px] items-center justify-center rounded-md text-heading-s font-bold text-pine hover:bg-pine-soft/50">
          이미 계정이 있어요 · 로그인
        </Link>
      </div>
    </form>
  );
}
