# Pruebas de base de datos

`tests/sql/functions.test.sql` ejercita las funciones de la tienda contra un PostgreSQL local con un entorno mínimo compatible con Supabase (`00_supabase_stub.sql`: roles `anon`, `authenticated`, `service_role`, esquema `auth` y los privilegios por defecto que Supabase concede).

Cubre: superficie pública (anon no lee pedidos ni productos ni ejecuta funciones operativas), configuración de precios e inventario, pedido Wompi con conciliación idempotente, pago duplicado, montos que no coinciden, validaciones de cliente, ciudad, molienda, inventario y contra entrega, flujo completo contra entrega, cancelación por token, vencimiento de reservas, aprobación tardía, reembolso con devolución de inventario, rechazo, edición de catálogo y limitador de solicitudes.

```bash
# PostgreSQL 15+ local (ajusta host/puerto/usuario)
createdb cafe_test
psql -d cafe_test -v ON_ERROR_STOP=1 -f tests/sql/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -d cafe_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d cafe_test -v ON_ERROR_STOP=1 -f tests/sql/functions.test.sql
```

Cada verificación imprime `ok: …`; cualquier falla detiene la ejecución con `FAIL …`.
