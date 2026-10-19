import "server-only";
import { createHash, randomBytes } from "node:crypto";

const TRACKING_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function newTrackingToken() {
  return randomBytes(32).toString("base64url");
}

export function isTrackingToken(value: unknown): value is string {
  return typeof value === "string" && TRACKING_TOKEN.test(value);
}

export function hashTrackingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newOrderReference() {
  return `CDT-${Date.now().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function trackingPath(token: string) {
  return `/seguimiento/${encodeURIComponent(token)}`;
}

export function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

/** Convierte una clave de ciudad escrita libremente en la clave normalizada. */
export function cityKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
