# Café Doña Tere · tienda en línea

Tienda de Finca La Libertad (Cachipay, Cundinamarca) en **Next.js 16 (App Router), React 19 y TypeScript**, con **PostgreSQL en Supabase** y pagos con **Wompi** o **contra entrega**.

- Tres cafés a la venta: Tostado a la leña, Tostión de precisión y el microlote Honey Red, con presentaciones y molienda por método de preparación. Lavado, Natural, Honey Black y Microlote Honey quedan creados pero ocultos, listos para publicarse desde el panel cuando haya lote.
- "Elegir café": tabla comparativa de los cafés publicados y asistente "Ayúdame a elegir" (sabor, con o sin leche y método) que solo recomienda lo que está en la vitrina.
- Bolsa persistente, checkout en dos pasos con ciudades y domicilio configurados en el panel, pago en línea (Wompi Web Checkout) o contra entrega.
- Seguimiento privado del pedido, reintento de pago y cancelación por el cliente.
- Panel `/admin` para pedidos, inventario, catálogo (textos, precios, presentaciones nuevas) y ciudades de envío.
- Sin configuración de pagos la tienda funciona en **modo WhatsApp**: el cliente arma la bolsa y la envía con un mensaje listo.
- **Publicada en GitHub Pages** como sitio estático en modo WhatsApp: `https://mibernal.github.io/Cafe-Do-a-Tere/`. El catálogo se lee de Supabase en cada build. CI, publicación, migraciones de Supabase con aprobación, CodeQL y Dependabot corren en GitHub Actions: ver [`docs/despliegue.md`](docs/despliegue.md).
- Datos del negocio que aún faltan (legales, precios, café, etiquetas): [`docs/datos-pendientes.md`](docs/datos-pendientes.md). Migración a un hosting con servidor para cobrar en línea: [`docs/migracion-hosting.md`](docs/migracion-hosting.md).

## Desarrollo local

Requisitos: Node.js 20.9 o posterior.

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:4173 (app completa, con panel)
npm run typecheck
npm run build && npm start

npm run build:pages    # sitio estático para GitHub Pages en out/
npm run preview:pages  # http://127.0.0.1:4180/
npm run test:pages     # pruebas en navegador del sitio estático (Playwright)
npm run test:sql       # migraciones + pruebas SQL (necesita PostgreSQL local)
```

Sin credenciales de Supabase la tienda muestra el catálogo de referencia (precios por confirmar) y la bolsa se envía por WhatsApp. No se crean pedidos ni se simulan pagos.

Las fuentes (Playfair Display y DM Sans, licencia OFL) están en `app/fonts/`: el build no depende de Google Fonts y el navegador del cliente no contacta a terceros para cargarlas.

## Puesta en marcha

### 1. Supabase

1. Crea el proyecto y copia en `.env.local` la URL, la llave publicable y la llave de servicio. La llave de servicio jamás lleva el prefijo `NEXT_PUBLIC_`.
2. Aplica **en orden** las migraciones de `supabase/migrations/` (editor SQL o `supabase db push`):
   - `202610180001_store_core.sql`
   - `202610180002_hardening_and_operations.sql`
   - `202610180003_brew_method_grinds.sql`
   - `202610190004_varieties_cod_operations.sql` (variedades nuevas, contra entrega, zonas de envío públicas, operación completa del panel)
   - `202610190005_catalogo_vigente.sql` (deja publicados solo los tres cafés vigentes y presenta el Honey Red como microlote; no toca cafés a los que ya les confirmaste precio o cargaste inventario)
   - `202610190006_altura_finca.sql` (completa la altura confirmada de la finca, 1.450–1.650 m s. n. m., en los cafés que seguían «por confirmar»)

   La migración 004 cambia funciones que usa la app: despliega la base de datos y esta versión del código al mismo tiempo.
3. En **Authentication → Providers → Email** desactiva el registro público (*Allow new users to sign up*). Crea la cuenta de Doña Tere y asígnale el rol desde el editor SQL (nunca en `user_metadata`, que el usuario puede editar):

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'admin@tu-dominio.com';
   ```
4. Programa las tareas internas con `pg_cron` (Database → Extensions → pg_cron):

   ```sql
   -- Libera reservas vencidas: pagos Wompi sin completar (35 min) y
   -- pedidos contra entrega sin confirmar (72 h).
   select cron.schedule('cafe-expirar-reservas', '*/5 * * * *', $$select public.expire_checkout_orders();$$);
   -- Limpia huellas temporales del limitador de solicitudes.
   select cron.schedule('cafe-limpiar-limites', '17 3 * * *', $$select public.prune_store_rate_limits();$$);
   ```

### 2. Catálogo, inventario y envíos (en `/admin`)

1. **Catálogo:** revisa textos, publica u oculta cada café y confirma el precio de cada presentación. Un café publicado sin precio confirmado se ve en la tienda y se consulta por WhatsApp hasta que confirmes precio y cargues unidades. Para lanzar una variedad oculta (Lavado, Natural, Honey Black), márcala como publicada: aparece sola en el catálogo, la comparación, el asistente y el menú. Puedes crear presentaciones nuevas (por ejemplo 1 kg).
   Las notas de taza se editan aquí; la escala de intensidad, acidez, cuerpo y dulzor de la comparación y las reglas del asistente están en `lib/coffee-profiles.ts` (valores de referencia: ajústalos con la catación de la finca).
2. **Inventario:** suma las unidades de cada tostión. Una presentación se vende en línea solo con precio confirmado, inventario disponible y el producto publicado.
3. **Ciudades y domicilios:** crea cada ciudad con su tarifa, el tiempo estimado y si acepta contra entrega. El cliente elige su ciudad de esa lista y el servidor suma el domicilio.

### 3. Wompi

1. En `.env.local`: `WOMPI_ENVIRONMENT=test`, llaves `pub_test_…` / `prv_test_…`, secreto de integridad y secreto de eventos (Dashboard → Desarrolladores → Secretos para integración técnica).
2. Registra el webhook `https://tu-dominio/api/webhooks/wompi` para `transaction.updated`.
3. Prueba en sandbox: aprobado, rechazado, PSE pendiente, pago abandonado y reintento desde el seguimiento.
4. Para producción cambia juntas `WOMPI_ENVIRONMENT=production` y las llaves `pub_prod_…` / `prv_prod_…`.

Los medios disponibles (tarjetas, PSE, Nequi, Botón y QR Bancolombia, efectivo en corresponsales, Puntos Colombia) dependen de lo habilitado en tu cuenta Wompi; la tienda usa el checkout alojado, así que no maneja datos de tarjetas.

### 4. Contra entrega

Activa `CASH_ON_DELIVERY_ENABLED=true`, define `CASH_ON_DELIVERY_MAX_COP` y marca en `/admin` las ciudades donde aplica. Flujo:

1. El cliente confirma el pedido; las unidades quedan reservadas 72 horas (`Contra entrega por confirmar`).
2. Doña Tere lo confirma con el cliente (botón de WhatsApp en el pedido) y lo pasa a preparación: la reserva se convierte en venta.
3. Lo despacha (mensajero o transportadora; guía y enlace de rastreo opcionales).
4. Al entregarlo marca **Entregado y pago recibido**: queda registrado el recaudo.

Controles: tope por pedido, máximo tres pedidos contra entrega por celular al día, límite de pedidos por IP y vencimiento automático si no se confirma.

### 5. Abrir la tienda

Cuando precios, inventario, ciudades, textos legales y credenciales estén listos:

```
STORE_CHECKOUT_ENABLED=true
PRIVACY_POLICY_VERSION=2026-10-v1
NEXT_PUBLIC_SITE_URL=https://tu-dominio.co
```

El panel muestra en **Estado de la tienda** qué falta. Completa antes los borradores de `/privacidad` y `/terminos` con la razón social, NIT, dirección y condiciones reales, y hazlos revisar.

## Cómo funciona el pago en línea

1. `POST /api/checkout` valida el origen, el formato (Zod) y el límite de solicitudes; la función `create_checkout_order` bloquea cada presentación, verifica precio, molienda e inventario, reserva unidades y calcula el total con la tarifa de la ciudad. El navegador nunca envía precios.
2. El servidor firma el formulario del Web Checkout: `SHA-256(referencia + centavos + COP + expiración + secreto de integridad)`, con vencimiento de 30 minutos que nunca supera la reserva. Prellena nombre, correo, celular y documento.
3. Wompi devuelve al cliente a `/seguimiento/<token>?id=<transacción>`. La página consulta la transacción con la llave privada y la concilia de inmediato si la referencia coincide.
4. El webhook verifica la firma del evento (propiedades + timestamp + secreto de eventos), el ambiente y la antigüedad, vuelve a consultar la transacción en la API de Wompi y concilia de forma idempotente.
5. Si el pago llega después de vencer la reserva y ya no hay inventario, el pedido queda en **Pago por revisar**; un segundo pago aprobado para la misma referencia genera una alerta en el panel.

Reembolsos: se hacen en el dashboard de Wompi y se registran en el panel (**Registrar reembolso**), con opción de devolver las unidades al inventario.

## Seguridad

- RLS en todas las tablas; el navegador solo lee el catálogo y las ciudades activas mediante funciones de solo lectura que no exponen conteos de inventario.
- Funciones operativas `security definer` con `search_path` fijo, ejecutables solo con la llave de servicio.
- CSP con nonce por solicitud, `form-action` limitado a Wompi, `frame-ancestors 'none'`, HSTS, COOP, `nosniff` y `Permissions-Policy` restrictiva.
- Rutas que cambian estado: verificación de `Origin`, JSON con tamaño máximo, validación estricta y sesión de Supabase con rol `admin` en `app_metadata`.
- Seguimiento con token aleatorio de 256 bits; en la base solo se guarda su hash y la página no muestra dirección, correo ni teléfono.
- El limitador de solicitudes usa la última IP de `X-Forwarded-For`. Publica la app detrás de un proxy que sobrescriba ese encabezado (Vercel lo hace); si falta, todos los clientes comparten un mismo cupo.

El detalle de la revisión está en `docs/auditoria-2026-10.md`.

## Estructura

Los archivos `*.server.ts(x)` son rutas que necesitan servidor (API, panel, seguimiento y `proxy.server.ts`): existen en el build con servidor y se omiten en el sitio estático de GitHub Pages.

```
.github/workflows/      CI, publicación en Pages, migraciones de Supabase, CodeQL
app/                    páginas, rutas API y estilos (globals.css)
  api/checkout          crear pedido y cancelar reserva
  api/webhooks/wompi    eventos firmados de Wompi
  api/admin/*           operación del panel
  seguimiento/[token]   seguimiento del cliente
components/store/       tienda (bolsa, catálogo, checkout, secciones)
components/             panel, seguimiento y páginas legales
lib/                    catálogo, configuración, Wompi, pagos, utilidades
scripts/                build y vista previa del sitio estático, pruebas SQL
supabase/migrations/    esquema, funciones y datos iniciales
tests/                  pruebas SQL (tests/sql) y en navegador (tests/e2e)
public/assets/          fotografías y etiquetas
legacy-prototype/       prototipo estático anterior (solo consulta)
```

Las etiquetas de Lavado, Natural, Honey Red y Honey Black (`public/assets/cafe-*-front.jpg`) son ilustrativas: se generaron a partir de la etiqueta de Tostión de precisión. Reemplázalas por las definitivas con el mismo nombre de archivo.
