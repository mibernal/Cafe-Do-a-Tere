import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { hasDatabaseConfig } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sameOriginRequest } from "@/lib/request";

const noStore = { "Cache-Control": "private, no-store" };

export function adminJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export function isAdminUser(user: User | null): user is User {
  return Boolean(user && user.app_metadata?.role === "admin");
}

/**
 * Valida origen, configuración y sesión administrativa. Devuelve el usuario o
 * la respuesta de error que la ruta debe retornar.
 */
export async function requireAdmin(request: Request): Promise<{ user: User } | { response: NextResponse }> {
  if (!sameOriginRequest(request)) return { response: adminJson({ error: "Solicitud no válida." }, 403) };
  if (!hasDatabaseConfig() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { response: adminJson({ error: "El panel aún no está configurado." }, 503) };
  }
  const auth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!isAdminUser(user)) return { response: adminJson({ error: "Tu sesión terminó. Vuelve a ingresar." }, 401) };
  return { user };
}
