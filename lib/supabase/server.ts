import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const secureCookie = process.env.NODE_ENV === "production";
  const authCookieOptions = { httpOnly: true, secure: secureCookie, sameSite: "lax" as const, path: "/" };
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options, ...authCookieOptions }));
          } catch { /* Server components cannot write cookies. */ }
        },
      },
    },
  );
}
