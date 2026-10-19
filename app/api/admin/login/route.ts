import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasDatabaseConfig } from "@/lib/supabase/admin";
import {
  rateLimitFingerprint,
  rateLimitIdentity,
  readJsonBody,
  sameOriginRequest,
} from "@/lib/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentials = z
  .object({ email: z.email().max(254), password: z.string().min(1).max(256) })
  .strict();

export async function POST(request: Request) {
  if (!sameOriginRequest(request))
    return NextResponse.json(
      { error: "Solicitud no válida." },
      { status: 403 },
    );
  if (!hasDatabaseConfig() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: "El acceso administrativo aún no está configurado." },
      { status: 503 },
    );
  }

  const requestBody = await readJsonBody(request, 8_192);
  if (!requestBody.ok)
    return NextResponse.json(
      { error: requestBody.error },
      { status: requestBody.status },
    );
  const parsed = credentials.safeParse(requestBody.value);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos." },
      { status: 400 },
    );

  const admin = createAdminClient();
  const { data: ipAllowed, error: ipLimitError } = await admin.rpc(
    "consume_admin_login_limit",
    {
      p_fingerprint: rateLimitFingerprint(request, "admin-login"),
    },
  );
  if (ipLimitError || ipAllowed !== true) {
    return NextResponse.json(
      {
        error: ipLimitError
          ? "El acceso está temporalmente no disponible."
          : "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
      },
      {
        status: ipLimitError ? 503 : 429,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  const { data: identityAllowed, error: identityLimitError } = await admin.rpc(
    "consume_admin_login_limit",
    {
      p_fingerprint: rateLimitIdentity("admin-account", parsed.data.email),
    },
  );
  if (identityLimitError || identityAllowed !== true) {
    return NextResponse.json(
      {
        error: identityLimitError
          ? "El acceso está temporalmente no disponible."
          : "Demasiados intentos para esta cuenta. Espera antes de volver a intentarlo.",
      },
      {
        status: identityLimitError ? 503 : 429,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user || data.user.app_metadata.role !== "admin") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "No se pudo iniciar sesión con una cuenta administradora." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
