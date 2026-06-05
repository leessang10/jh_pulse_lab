type SupabaseEnv = {
  [key: string]: string | undefined;
};

export const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
export const SUPABASE_SECRET_KEY_ENV = "SUPABASE_SECRET_KEY";

function readRequiredEnv(env: SupabaseEnv, key: string) {
  const value = env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function getSupabaseUrl(env: SupabaseEnv = process.env) {
  return readRequiredEnv(env, SUPABASE_URL_ENV);
}

export function getSupabasePublishableKey(env: SupabaseEnv = process.env) {
  return readRequiredEnv(env, SUPABASE_PUBLISHABLE_KEY_ENV);
}

export function getSupabaseSecretKey(env: SupabaseEnv = process.env) {
  return readRequiredEnv(env, SUPABASE_SECRET_KEY_ENV);
}
