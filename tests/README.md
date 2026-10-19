# Pruebas

- `tests/sql`: funciones y permisos de la base de datos (abajo).
- `tests/e2e`: recorrido del sitio estático en navegador, en escritorio y móvil (Playwright): portada sin errores ni imágenes rotas, CSP, bolsa que termina en WhatsApp, asistente, páginas legales y 404 bajo el subdirectorio de GitHub Pages. Corre con `npm run build:pages && npm run test:pages` (la primera vez: `npx playwright install chromium`).

Ambas corren en CI en cada PR (ver `docs/despliegue.md`).

## Base de datos

`tests/sql/functions.test.sql` ejercita las funciones de la tienda contra un PostgreSQL local con un entorno mínimo compatible con Supabase (`00_supabase_stub.sql`: roles `anon`, `authenticated`, `service_role`, esquema `auth` y los privilegios por defecto que Supabase concede).

Cubre: superficie pública (anon no lee pedidos ni productos ni ejecuta funciones operativas), configuración de precios e inventario, pedido Wompi con conciliación idempotente, pago duplicado, montos que no coinciden, validaciones de cliente, ciudad, molienda, inventario y contra entrega, flujo completo contra entrega, cancelación por token, vencimiento de reservas, aprobación tardía, reembolso con devolución de inventario, rechazo, edición de catálogo y limitador de solicitudes.

```bash
# PostgreSQL 15+ local; usa PGHOST, PGPORT, PGUSER y PGPASSWORD.
# Crea (o recrea) la base cafe_test y los roles de Supabase en ese servidor.
npm run test:sql
```

Cada verificación imprime `ok: …`; cualquier falla detiene la ejecución con `FAIL …`.
