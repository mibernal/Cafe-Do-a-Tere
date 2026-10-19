import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sameOriginRequest } from "@/lib/request";

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return new NextResponse("Solicitud no válida.", { status: 403 });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!canonicalOrigin) return new NextResponse("El origen de la tienda no está configurado.", { status: 503 });
  const response = NextResponse.redirect(new URL("/admin/login", canonicalOrigin), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
