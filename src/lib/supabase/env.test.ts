import { describe, expect, it } from "vitest";
import {
  SUPABASE_PUBLISHABLE_KEY_ENV,
  SUPABASE_SECRET_KEY_ENV,
  SUPABASE_URL_ENV,
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "./env";

describe("Supabase env policy", () => {
  it("uses only current publishable and secret key names", () => {
    expect(SUPABASE_URL_ENV).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(SUPABASE_PUBLISHABLE_KEY_ENV).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(SUPABASE_SECRET_KEY_ENV).toBe("SUPABASE_SECRET_KEY");
  });

  it("reads required Supabase values from the provided environment", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    };

    expect(getSupabaseUrl(env)).toBe(env.NEXT_PUBLIC_SUPABASE_URL);
    expect(getSupabasePublishableKey(env)).toBe(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    expect(getSupabaseSecretKey(env)).toBe(env.SUPABASE_SECRET_KEY);
  });

  it("does not fall back to legacy anon or service role keys", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    };

    expect(() => getSupabasePublishableKey(env)).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
    expect(() => getSupabaseSecretKey(env)).toThrow("SUPABASE_SECRET_KEY is required");
  });
});
