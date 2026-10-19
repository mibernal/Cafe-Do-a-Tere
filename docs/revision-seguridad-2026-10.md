# Revisión de seguridad y rendimiento · octubre de 2026

Revisión del sitio publicado en GitHub Pages (modo catálogo con pedidos por WhatsApp) y del repositorio, antes de migrar a un hosting con servidor.

## Resumen

| # | Hallazgo | Riesgo | Estado |
|---|---|---|---|
| 1 | `anon` y `authenticated` conservaban `INSERT`, `UPDATE`, `DELETE` y `TRUNCATE` sobre todas las tablas, por los privilegios por defecto de Supabase. RLS bloqueaba las escrituras, pero `TRUNCATE` no está sujeto a RLS, y cualquier tabla nueva quedaba expuesta por defecto. | Medio (defensa en profundidad) | **Corregido**: migración `007`, más 3 verificaciones SQL |
| 2 | Las acciones de GitHub estaban fijadas por versión mayor (`@v7`). Una etiqueta movida en el repositorio de la acción habría cambiado el código que corre con los permisos del workflow. | Medio (cadena de suministro) | **Corregido**: todas fijadas por SHA, con la versión en un comentario; Dependabot las mantiene |
| 3 | Dependencias con actualizaciones pendientes (PR #2 y #3 de Dependabot). | Bajo | **Corregido**: incluidas en este cambio |
| 4 | GitHub Pages publica dos veces en cada cambio (el workflow y el publicador clásico desde la rama), y el clásico publica el README. | Alto (integridad del sitio) | **Pendiente del propietario**: *Settings → Pages → Source: GitHub Actions* |
| 5 | El ambiente `supabase-production` corre sin aprobación, y su `SUPABASE_DB_URL` no conecta. | Alto cuando la conexión funcione | **Pendiente del propietario**: agregar *Required reviewers* y corregir el secreto (URI del Session pooler) |
| 6 | GitHub Pages no permite cabeceras propias: no hay `frame-ancestors`, `X-Frame-Options` ni `Permissions-Policy`. | Bajo (el sitio no tiene acciones sensibles ni sesión) | Aceptado; el modo con servidor ya los envía (`next.config.ts`) |
| 7 | La cédula del responsable es pública en `/terminos` y `/privacidad`. | Bajo o medio (exposición de datos personales) | Decisión del propietario; alternativa: publicar el NIT del RUT |
| 8 | Llave `sb_secret` compartida en una conversación; llaves *legacy* de Supabase activas. | Alto si se filtró | **Pendiente del propietario**: rotar la llave secreta y desactivar las *legacy* |
| 9 | Registro público abierto en Supabase Auth. Solo da acceso con el rol `admin` en `app_metadata`. | Bajo | **Pendiente del propietario**: desactivar *Allow new users to sign up*; activar MFA |

Sin hallazgos en:

- **Dependencias:** `npm audit` reporta 0 vulnerabilidades.
- **Secretos versionados:** se revisaron el historial completo y `respaldo-original-2026-10-18.tar.gz`; solo hay valores de ejemplo.
- **CSP del sitio estático:** hashes por página, sin `unsafe-eval` y `connect-src 'self'`.
- **Bolsa guardada en el navegador:** cada línea se valida contra el catálogo al restaurarla.
- **Enlaces externos:** todos llevan `rel="noopener noreferrer"`.
- **RLS:** activado en todas las tablas. Las lecturas de pedidos y auditoría exigen `app_metadata.role = 'admin'`, y `anon` solo ejecuta las dos funciones del catálogo.

## Rendimiento

Medido con Lighthouse 12 sobre el mismo build que publica GitHub Pages: catálogo de referencia, subdirectorio `/Cafe-Do-a-Tere` y compresión gzip como la de Pages.

| | Antes (móvil) | Después (móvil) | Antes (escritorio) | Después (escritorio) |
|---|---|---|---|---|
| Rendimiento | 87 | 89 | 99 | 99 |
| LCP (imagen principal) | 4,0 s | 3,7 s | 0,9 s | 0,9 s |
| Peso total | 777 KiB | 547 KiB | 944 KiB | 663 KiB |
| Accesibilidad, buenas prácticas y SEO | 100 | 100 | 100 | 100 |

Cambios:

- **Imágenes responsivas:** `scripts/build-pages.mjs` genera versiones WebP por ancho (96 a 1.080 px, sin agrandar el original) y `lib/image-loader.ts` las enlaza con `srcset`. Antes se servía el JPG completo a todas las pantallas.
- **Imagen principal:** se carga con `fetchPriority="high"`.
- **Fuentes:** ya no se precargan las cursivas (78 KB) que la tienda casi no usa.
- **Logo:** se quitó de `public/` el PNG de 466 KB, que no se usaba. Sigue en `assets/`.
- **Accesibilidad:** el botón de la bolsa se llama «Bolsa», igual que su texto visible.
- **Servidor local:** `scripts/serve-static.mjs` ahora comprime con gzip como Pages, para que las mediciones locales sean comparables.

Lo que sigue pesando en móvil es el JavaScript base de React y Next.js (unos 160 KB comprimidos). Los recursos se guardan en caché solo 10 minutos, que es la política fija de GitHub Pages. En Netlify se pueden servir `/_next/static` y `/assets/_w` con caché inmutable.

## SEO en GitHub Pages

En un sitio de proyecto (`usuario.github.io/repositorio`), los buscadores ignoran `/Cafe-Do-a-Tere/robots.txt`: solo leen el de la raíz del dominio. El mapa del sitio se debe enviar a mano en Google Search Console, o el problema se resuelve con un dominio propio.

## Para la migración

Al pasar a un hosting con servidor (ver `docs/migracion-hosting.md`):

- Las cabeceras de seguridad, el CSP con nonce y HSTS ya están en `next.config.ts` y `proxy.server.ts`.
- El build con servidor usa el optimizador de imágenes de Next.js; el loader estático solo aplica a `npm run build:pages`.
- Cualquier tabla o función nueva en Supabase debe conceder sus permisos de forma explícita: después de la migración 007 nada queda expuesto por defecto.
