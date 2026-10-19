import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || !configuredOrigin) return false;

  try {
    const expected = new URL(configuredOrigin);
    const actual = new URL(origin);
    return actual.origin === expected.origin;
  } catch {
    return false;
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, error: "Formato de solicitud no válido." };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return {
        ok: false,
        status: 400,
        error: "El tamaño de la solicitud no es válido.",
      };
    }
    if (Number(contentLength) > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: "La solicitud es demasiado grande.",
      };
    }
  }

  const reader = request.body?.getReader();
  if (!reader)
    return {
      ok: false,
      status: 400,
      error: "El contenido de la solicitud no es válido.",
    };

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        return {
          ok: false,
          status: 413,
          error: "La solicitud es demasiado grande.",
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: "No fue posible leer la solicitud.",
    };
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "El contenido de la solicitud no es válido.",
    };
  }
}

export function trustedClientAddress(request: Request) {
  // The deployment proxy must overwrite/append this header with the connecting
  // client address. Use the final hop rather than a caller-controlled X-Real-IP.
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .at(-1)
    ?.trim();
  return forwarded && isIP(forwarded) ? forwarded : "unknown";
}

function fingerprint(value: string) {
  const secret =
    process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Rate limit signing secret is not configured.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function rateLimitFingerprint(request: Request, scope: string) {
  return fingerprint(`${scope}:${trustedClientAddress(request)}`);
}

export function rateLimitIdentity(scope: string, identity: string) {
  return fingerprint(`${scope}:${identity.trim().toLowerCase()}`);
}
