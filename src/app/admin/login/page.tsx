"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminSession, loginAdmin } from "@/lib/admin-auth-actions";
import { ADMIN_DEFAULT_PATH, getPostLoginAdminPath } from "@/lib/admin-routes";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginFallback />}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginFallback() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-5 py-6">
      <Card className="w-full border bg-card">
        <CardContent className="p-8 text-center text-muted-foreground">관리자 로그인을 준비하는 중입니다.</CardContent>
      </Card>
    </main>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSessionReady, setIsSessionReady] = useState(false);
  const nextPath = getPostLoginAdminPath(searchParams.get("next"));

  useEffect(() => {
    let isMounted = true;

    getAdminSession()
      .then((user) => {
        if (!isMounted) return;
        if (user) router.replace(ADMIN_DEFAULT_PATH);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsSessionReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function submitLogin() {
    const result = await loginAdmin(email, password);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setPassword("");
    toast.success("로그인했습니다.");
    router.replace(nextPath);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-5 py-6">
      <Card className="w-full border bg-card">
        <CardHeader>
          <CardTitle>관리자 로그인</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!isSessionReady ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm font-semibold text-muted-foreground">
              관리자 세션을 확인하는 중입니다.
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold">
            이메일
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            비밀번호
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitLogin();
              }}
              type="password"
              value={password}
            />
          </label>
          <Button className="h-11" onClick={submitLogin} type="button">
            로그인
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
