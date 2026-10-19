import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "manifest-src 'self'",
    "font-src 'self' data:",
    // El navegador solo habla con este mismo origen; Supabase y Wompi se
    // consultan desde el servidor.
    "connect-src 'self'" + (isDevelopment ? " ws://127.0.0.1:* ws://localhost:*" : ""),
    // El checkout alojado de Wompi recibe el formulario firmado.
    "form-action 'self' https://checkout.wompi.co",
    "frame-src 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const applyResponseHeaders = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", policy);
    return response;
  };
  let response = applyResponseHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );

  const pathname = request.nextUrl.pathname;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (pathname.startsWith("/admin") && supabaseUrl && supabaseAnonKey) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          requestHeaders.set("cookie", request.cookies.toString());
          response = applyResponseHeaders(
            NextResponse.next({ request: { headers: requestHeaders } }),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, ...cookieOptions }),
          );
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    });
    // Server Components cannot persist refresh cookies. Refresh here so the
    // admin session survives token rotation and reaches both render and browser.
    await supabase.auth.getClaims();
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|assets|robots.txt|sitemap.xml|icon.png|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
