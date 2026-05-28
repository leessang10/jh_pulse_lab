"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

export async function getAdminSession() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function loginAdmin(email: string, password: string): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { ok: false, error: "관리자 로그인 정보를 확인해 주세요." };

  revalidatePath("/admin");
  return { ok: true };
}

export async function logoutAdmin(): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) return { ok: false, error: "로그아웃하지 못했습니다." };

  revalidatePath("/admin");
  return { ok: true };
}
