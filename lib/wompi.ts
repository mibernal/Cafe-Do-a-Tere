import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { DocumentType } from "@/lib/store-types";

export const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";
const CHECKOUT_WINDOW_MS = 30 * 60 * 1000;
const MIN_REMAINING_MS = 2 * 60 * 1000;

const authoritativeTransactionSchema = z
  .object({
    data: z
      .object({
        id: z.string().min(1).max(120),
        reference: z.string().min(1).max(255),
        status: z.enum(["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"]),
        amount_in_cents: z.number().int().positive().safe(),
        currency: z.literal("COP"),
        payment_method_type: z.string().max(60).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type WompiTransaction = z.infer<typeof authoritativeTransactionSchema>["data"];

export type WompiCustomer = {
  email: string;
  fullName: string;
  phone: string;
  documentType?: DocumentType;
  documentNumber?: string;
};

export type WompiCheckoutForm = {
  action: string;
  fields: [string, string][];
};

/**
 * Construye el formulario del Web Checkout de Wompi. La firma de integridad
 * se calcula en servidor: SHA-256(referencia + monto en centavos + moneda +
 * fecha de expiración + secreto de integridad).
 *
 * `orderExpiresAt` limita la vigencia del enlace para que nunca supere la
 * reserva de inventario del pedido.
 */
export function wompiCheckoutForm(input: {
  reference: string;
  amountCop: number;
  trackingToken: string;
  orderExpiresAt?: Date;
  customer?: WompiCustomer;
}): WompiCheckoutForm {
  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!publicKey || !secret || !siteUrl) throw new Error("Wompi is not configured.");
  if (!Number.isSafeInteger(input.amountCop) || input.amountCop <= 0) throw new Error("Invalid amount.");

  const now = Date.now();
  let expiresAt = now + CHECKOUT_WINDOW_MS;
  if (input.orderExpiresAt) {
    expiresAt = Math.min(expiresAt, input.orderExpiresAt.getTime() - 60_000);
  }
  if (expiresAt - now < MIN_REMAINING_MS) throw new Error("Checkout window closed.");

  const amountInCents = input.amountCop * 100;
  const expirationTime = new Date(expiresAt).toISOString();
  const integrity = createHash("sha256")
    .update(`${input.reference}${amountInCents}COP${expirationTime}${secret}`)
    .digest("hex");

  const fields: [string, string][] = [
    ["public-key", publicKey],
    ["currency", "COP"],
    ["amount-in-cents", String(amountInCents)],
    ["reference", input.reference],
    ["signature:integrity", integrity],
    ["redirect-url", `${siteUrl.replace(/\/$/, "")}/seguimiento/${encodeURIComponent(input.trackingToken)}`],
    ["expiration-time", expirationTime],
  ];

  // Prellenar los datos evita que el cliente los escriba dos veces.
  if (input.customer) {
    fields.push(
      ["customer-data:email", input.customer.email],
      ["customer-data:full-name", input.customer.fullName],
      ["customer-data:phone-number", input.customer.phone],
    );
    if (input.customer.documentType && input.customer.documentNumber) {
      fields.push(
        ["customer-data:legal-id-type", input.customer.documentType],
        ["customer-data:legal-id", input.customer.documentNumber],
      );
    }
  }

  return { action: WOMPI_CHECKOUT_URL, fields };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(source: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((value, key) => {
    if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, key)) return undefined;
    return value[key];
  }, source);
}

/**
 * Verifica la firma de un evento de Wompi: SHA-256 de los valores indicados
 * en signature.properties (dentro de data), el timestamp y el secreto de
 * eventos. Rechaza ambientes cruzados y eventos con más de 48 h.
 */
export function verifyWompiEvent(
  event: unknown,
  headerChecksum: string | null,
  requiredProperties: string[] = [],
) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret || !isRecord(event) || !isRecord(event.signature) || !isRecord(event.data)) return false;

  const configuredEnvironment = process.env.WOMPI_ENVIRONMENT;
  const expectedEnvironment =
    configuredEnvironment === "production" ? "prod" : configuredEnvironment === "test" ? "test" : null;
  if (!expectedEnvironment || event.environment !== expectedEnvironment) return false;

  const timestamp = event.timestamp;
  const properties = event.signature.properties;
  if (
    !Number.isSafeInteger(timestamp) ||
    (timestamp as number) < 0 ||
    !Array.isArray(properties) ||
    properties.length < 1 ||
    properties.length > 30
  )
    return false;
  if (requiredProperties.some((property) => !properties.includes(property))) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - (timestamp as number)) > 48 * 60 * 60) return false;
  if (
    !properties.every(
      (path) =>
        typeof path === "string" &&
        path.length <= 160 &&
        /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(path) &&
        !/(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/.test(path),
    )
  )
    return false;

  const bodyChecksum = typeof event.signature.checksum === "string" ? event.signature.checksum.toLowerCase() : "";
  const headerValue = headerChecksum?.trim().toLowerCase() ?? "";
  if (bodyChecksum && headerValue && bodyChecksum !== headerValue) return false;
  const checksum = bodyChecksum || headerValue;
  if (!/^[a-f0-9]{64}$/.test(checksum)) return false;

  const parts = properties.map((path) => readPath(event.data, path as string));
  if (
    parts.some(
      (part) =>
        !["string", "number", "boolean"].includes(typeof part) ||
        (typeof part === "number" && !Number.isFinite(part)),
    )
  )
    return false;
  const expected = createHash("sha256")
    .update(`${parts.join("")}${timestamp}${secret}`)
    .digest("hex");
  const expectedBytes = Buffer.from(expected);
  const checksumBytes = Buffer.from(checksum);
  return expectedBytes.length === checksumBytes.length && timingSafeEqual(expectedBytes, checksumBytes);
}

export function isWompiTransactionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{6,120}$/.test(value);
}

/** Consulta la transacción en la API de Wompi con la llave privada. */
export async function fetchWompiTransaction(transactionId: string): Promise<WompiTransaction> {
  if (!isWompiTransactionId(transactionId)) throw new Error("Invalid transaction id.");
  const environment = process.env.WOMPI_ENVIRONMENT;
  const privateKey = process.env.WOMPI_PRIVATE_KEY ?? "";
  const isTest = environment === "test" && privateKey.startsWith("prv_test_");
  const isProduction = environment === "production" && privateKey.startsWith("prv_prod_");
  if (!isTest && !isProduction) throw new Error("Wompi private key is not configured for the selected environment.");

  const baseUrl = isTest ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
  const response = await fetch(`${baseUrl}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${privateKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Wompi transaction lookup failed with status ${response.status}.`);
  const parsed = authoritativeTransactionSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Wompi returned an invalid transaction response.");
  return parsed.data.data;
}

/** Clave idempotente para registrar un estado de transacción una sola vez por origen. */
export function settlementKey(source: string, transactionId: string, status: string) {
  return createHash("sha256").update(`${source}:${transactionId}:${status}`).digest("hex");
}
