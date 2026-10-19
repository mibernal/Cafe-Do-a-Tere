#!/usr/bin/env node
// Servidor estático mínimo que imita GitHub Pages, para revisar out/ y para
// las pruebas del sitio. Sin dependencias.
//
//   node scripts/serve-static.mjs [carpeta=out] [puerto=4180]
//   NEXT_PUBLIC_BASE_PATH=/Cafe-Do-a-Tere node scripts/serve-static.mjs

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createGzip } from "node:zlib";
import { extname, join, normalize, resolve, sep } from "node:path";

const dir = resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? process.env.PORT ?? 4180);
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function fileFor(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const target = normalize(join(dir, decoded));
  if (target !== dir && !target.startsWith(dir + sep)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  if (existsSync(index)) return index;
  return null;
}

// Como GitHub Pages, comprime con gzip los archivos de texto.
const compressible = new Set([".html", ".js", ".css", ".json", ".txt", ".xml", ".svg"]);

function send(request, response, status, file) {
  const gzip = compressible.has(extname(file)) && /\bgzip\b/.test(request.headers["accept-encoding"] ?? "");
  response.writeHead(status, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    ...(gzip ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : {}),
  });
  const stream = createReadStream(file);
  (gzip ? stream.pipe(createGzip()) : stream).pipe(response);
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (basePath && pathname === basePath) {
    response.writeHead(301, { Location: `${basePath}/` }).end();
    return;
  }
  if (basePath && !pathname.startsWith(`${basePath}/`)) {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("Fuera del sitio");
    return;
  }
  const relative = basePath ? pathname.slice(basePath.length) : pathname;
  // Igual que GitHub Pages: /terminos -> /terminos/
  if (!relative.endsWith("/") && !extname(relative) && fileFor(`${relative}/`)) {
    response.writeHead(301, { Location: `${pathname}/` }).end();
    return;
  }
  const file = fileFor(relative);
  if (file) return send(request, response, 200, file);
  const notFound = join(dir, "404.html");
  if (existsSync(notFound)) return send(request, response, 404, notFound);
  response.writeHead(404).end();
}).listen(port, "127.0.0.1", () => {
  console.log(`Sitio estático en http://127.0.0.1:${port}${basePath}/ (carpeta ${dir})`);
});
