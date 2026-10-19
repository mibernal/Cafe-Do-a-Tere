#!/usr/bin/env node
// Build del sitio estático para GitHub Pages (carpeta out/).
//
//   npm run build:pages                         -> sitio en la raíz (vista local)
//   NEXT_PUBLIC_BASE_PATH=/Cafe-Do-a-Tere npm run build:pages
//
// Pasos: `next build` con NEXT_PUBLIC_SITE_TARGET=pages, luego una Content
// Security Policy por página con el hash de cada script en línea (GitHub
// Pages no permite cabeceras propias) y comprobaciones mínimas del resultado.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "out");
const require = createRequire(import.meta.url);

function fail(message) {
  console.error(`\n✖ build:pages: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------- next build
rmSync(outDir, { recursive: true, force: true });
const env = { ...process.env, NEXT_PUBLIC_SITE_TARGET: "pages" };
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  cwd: root,
  env,
  stdio: "inherit",
});
if (result.status !== 0) fail("next build terminó con errores.");
if (!existsSync(join(outDir, "index.html"))) fail("no se generó out/index.html.");

// ------------------------------------------------- CSP con hashes por página
const inlineScript = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

function policyFor(html) {
  const hashes = new Set();
  for (const [, attributes, body] of html.matchAll(inlineScript)) {
    // Los bloques de datos (JSON) no se ejecutan; la CSP no los evalúa.
    if (/\btype=["']?application\/(ld\+)?json/i.test(attributes) || !body) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

let pages = 0;
for (const file of htmlFiles(outDir)) {
  const html = readFileSync(file, "utf8");
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(html)}"/>`;
  // Justo después del charset y antes de cualquier script.
  const charset = html.match(/<meta charSet="utf-8"\/?>/i);
  const updated = charset
    ? html.replace(charset[0], `${charset[0]}${meta}`)
    : html.replace(/<head[^>]*>/i, (head) => `${head}${meta}`);
  if (updated === html) fail(`no se pudo insertar la CSP en ${file}.`);
  writeFileSync(file, updated);
  pages += 1;
}

// ------------------------------------------- imágenes responsivas (WebP)
// Una versión por ancho de lib/image-widths.json para lib/image-loader.ts.
// Nunca se agranda el original: un ancho mayor recibe el tamaño original.
const sharp = require("sharp");
const widths = JSON.parse(readFileSync(join(root, "lib", "image-widths.json"), "utf8"));
const allWidths = [...new Set([...widths.imageSizes, ...widths.deviceSizes])].sort((a, b) => a - b);
const assetsDir = join(root, "public", "assets");
const responsiveDir = join(outDir, "assets", "_w");
mkdirSync(responsiveDir, { recursive: true });
let variants = 0;
for (const name of readdirSync(assetsDir)) {
  const match = /^(.+)\.(?:jpe?g|png)$/i.exec(name);
  if (!match) continue;
  const source = join(assetsDir, name);
  const { width: original } = await sharp(source).metadata();
  for (const width of allWidths) {
    await sharp(source)
      .resize({ width: Math.min(width, original), withoutEnlargement: true })
      .webp({ quality: 76, effort: 5 })
      .toFile(join(responsiveDir, `${match[1]}-${width}.webp`));
    variants += 1;
  }
}

// GitHub Pages con Actions no usa Jekyll, pero así _next/ nunca se ignora.
writeFileSync(join(outDir, ".nojekyll"), "");

// ------------------------------------------------------------ comprobaciones
const home = readFileSync(join(outDir, "index.html"), "utf8");
const cards = (home.match(/class="product-card/g) ?? []).length;
if (cards === 0) fail("la portada no tiene cafés publicados.");
if (/\/api\/|\/seguimiento\//.test(home)) fail("la portada enlaza rutas que solo existen con servidor.");
for (const forbidden of ["admin", "api", "seguimiento"]) {
  if (existsSync(join(outDir, forbidden))) fail(`out/${forbidden} no debe existir en el sitio estático.`);
}

// Documentos legales con datos pendientes: se publican como borrador visible,
// nunca en silencio.
const pendingLegal = ["terminos", "privacidad"]
  .map((page) => [page, (readFileSync(join(outDir, page, "index.html"), "utf8").match(/class="legal-pending"/g) ?? []).length])
  .filter(([, count]) => count > 0);
if (pendingLegal.length) {
  const detail = pendingLegal.map(([page, count]) => `/${page}/ (${count})`).join(", ");
  const message = `Documentos legales con datos pendientes: ${detail}. Se publican como borrador y sin indexar; ver docs/datos-pendientes.md.`;
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=Documentos legales en borrador::${message}` : `\n⚠ ${message}`);
}

console.log(`\n✓ Sitio estático listo en out/ (${pages} páginas con CSP, ${cards} cafés en la portada, ${variants} imágenes WebP).`);
