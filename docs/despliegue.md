# Publicación, pipelines y automatizaciones

## Qué se publica

- **Sitio:** `https://mibernal.github.io/Cafe-Do-a-Tere/` (GitHub Pages, desde GitHub Actions).
- **Modo:** sitio estático con pedidos por WhatsApp. Muestra los cafés, la comparación, el asistente "Ayúdame a elegir", la bolsa y las páginas legales. La bolsa termina en un mensaje de WhatsApp con el detalle del pedido.
- **No incluye** pago con Wompi, contra entrega, seguimiento de pedidos ni el panel `/admin`. GitHub Pages solo sirve archivos (no puede firmar pagos ni recibir webhooks). Ese código sigue en el repositorio, listo para un hosting con servidor.
- **Catálogo:** se lee de Supabase en cada build (cafés publicados, presentaciones, precios confirmados y disponibilidad). Si Supabase falla, el build se detiene y queda publicada la versión anterior; nunca se publica una tienda vacía.

> Los términos de GitHub Pages no permiten usarlo para operar una tienda en línea. Este sitio no cobra ni recoge datos (el pedido se cierra por WhatsApp), pero sigue siendo un catálogo comercial. Si GitHub lo objeta, el mismo `out/` se publica sin cambios en Netlify, cuyo plan gratuito permite uso comercial.

## Workflows

| Workflow | Cuándo corre | Qué hace |
|---|---|---|
| **CI** (`ci.yml`) | Cada PR y cada push a `main` | Tipos, build con servidor, build estático, pruebas en navegador (escritorio y móvil) sobre el sitio estático, migraciones + pruebas SQL en PostgreSQL 16 y revisión de dependencias nuevas en los PR. |
| **Publicar en GitHub Pages** (`deploy-pages.yml`) | Push a `main`, cada 6 horas, a mano y con el evento `catalogo-actualizado` | Build estático con el catálogo vigente, pruebas en navegador, publicación y verificación del sitio en línea. |
| **Migraciones de Supabase** (`supabase-migrations.yml`) | Push a `main` que cambie `supabase/migrations/`, o a mano | Valida en una base vacía, espera tu aprobación, muestra las migraciones pendientes, las aplica y vuelve a publicar el sitio. |
| **CodeQL** (`codeql.yml`) | PR, push a `main` y cada lunes | Análisis de seguridad de TypeScript y de los workflows. |
| **Dependabot** (`dependabot.yml`) | Lunes (npm) y mensual (Actions) | PR agrupados con actualizaciones; pasan por CI antes de fusionarse. |

## Configuración inicial (una sola vez)

1. **Activa Pages:** *Settings → Pages → Build and deployment → Source: GitHub Actions*.
2. **Secretos del catálogo:** *Settings → Secrets and variables → Actions → pestaña Secrets → **Repository secrets** → New repository secret*. Deben ser secretos del repositorio, no de un ambiente: el workflow de publicación no usa ambientes para el build.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la llave publicable / anon, la misma de `.env.local`)

   Nunca subas la `SUPABASE_SERVICE_ROLE_KEY` ni las llaves de Wompi: el sitio estático no las necesita.
3. **Variables públicas (opcional):** en la pestaña *Variables*: `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_INSTAGRAM_URL`. Sin ellas se usan los valores del código. Ahí también van los datos del responsable para las páginas legales: `BUSINESS_LEGAL_NAME`, `BUSINESS_TAX_ID`, `BUSINESS_ADDRESS` y `BUSINESS_LEGAL_EMAIL` (ver `docs/datos-pendientes.md`). Mientras falten, el build publica `/terminos` y `/privacidad` como borrador sin indexar y lo advierte en el resumen del workflow.
4. **Ambiente para migraciones:** *Settings → Environments → New environment* `supabase-production`:
   - *Required reviewers*: tu usuario (nada se aplica sin tu aprobación).
   - *Deployment branches and tags*: solo `main`.
   - *Environment secret* `SUPABASE_DB_URL`: en Supabase, *Connect → Session pooler*, copia la URI y pon la contraseña de la base. Usa el **Session pooler**: los runners de GitHub no tienen IPv6 y la conexión directa de Supabase sí lo requiere.
5. **Primera corrida de migraciones:** si ya aplicaste migraciones a mano en el editor SQL, el workflow se detiene para no ejecutarlas dos veces. Córrelo a mano (*Actions → Migraciones de Supabase → Run workflow*) y en **baseline** escribe las versiones que ya aplicaste, por ejemplo `202610180001 202610180002 202610180003 202610190004`. El workflow las registra como aplicadas y aplica solo las que faltan (por ejemplo la 005), después de tu aprobación.
6. **Protección del repositorio:**
   - *Settings → Code security*: activa Dependabot alerts, Dependabot security updates, Secret scanning y Push protection.
   - *Settings → Rules → Rulesets*: protege `main` exigiendo los checks **Aplicación** y **Base de datos** de CI.

## Operación

- **Cambiar precios, inventario o publicar un café:** abre el panel en tu computador (`npm run dev` y `http://localhost:4173/admin`, con tu `.env.local`) o usa el editor de tablas de Supabase. El sitio se actualiza solo en máximo 6 horas; para verlo de inmediato: *Actions → Publicar en GitHub Pages → Run workflow*.
- **Actualizar al instante al guardar en Supabase (opcional):** crea un *Database Webhook* en Supabase sobre `products` y `product_variants` que haga `POST https://api.github.com/repos/mibernal/Cafe-Do-a-Tere/dispatches` con el cuerpo `{"event_type":"catalogo-actualizado"}` y los encabezados `Accept: application/vnd.github+json` y `Authorization: Bearer <token>`. Usa un token *fine-grained* limitado a este repositorio, con permiso *Contents: Read and write* y fecha de vencimiento.
- **Revertir una publicación:** `git revert` del cambio y push a `main`, o *Re-run* de una ejecución anterior de "Publicar en GitHub Pages" (vuelve a construir ese mismo commit con el catálogo actual).
- **Probar el sitio estático en tu computador:**

  ```bash
  npm run build:pages
  npm run preview:pages        # http://127.0.0.1:4180/
  npm run test:pages           # requiere: npx playwright install chromium
  ```

  Para simular el subdirectorio de GitHub Pages: `NEXT_PUBLIC_BASE_PATH=/Cafe-Do-a-Tere` en los tres comandos.

## Dos destinos de build, un solo código

`NEXT_PUBLIC_SITE_TARGET=pages` (lo pone `npm run build:pages`) genera la exportación estática:

- Los archivos `*.server.ts(x)` (rutas API, panel, seguimiento y `proxy.server.ts`) solo existen en el build con servidor (`npm run build`); en la exportación estática no se compilan. Una ruta nueva que necesite servidor debe llevar ese sufijo.
- Las imágenes y rutas de `/public` pasan por `asset()` (`lib/site-target.ts`) para respetar el subdirectorio de GitHub Pages; los enlaces con `next/link` lo hacen solos.
- `scripts/build-pages.mjs` agrega a cada página una Content Security Policy con el hash de sus scripts en línea (GitHub Pages no permite cabeceras propias) y verifica que la portada tenga cafés y que no enlace rutas de servidor.

## Cuando quieras cobrar en línea

Sigue `docs/migracion-hosting.md`: modo aplicación completa (`npm run build`) en Netlify u otro hosting con servidor, variables de producción, pruebas con Wompi en ambiente de pruebas, checklist de aprobación y ruta de reversión. GitHub Pages se mantiene activo hasta que el propietario apruebe el nuevo hosting.

## Límites conocidos

- Precios y disponibilidad pueden tardar hasta 6 horas en reflejarse; el precio final siempre se confirma por WhatsApp.
- GitHub pausa los workflows programados de un repositorio público tras 60 días sin actividad; un commit o una ejecución manual los reactiva.
