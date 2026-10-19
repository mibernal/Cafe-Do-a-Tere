# Revisión de seguridad, errores y mejoras · octubre de 2026

Alcance: código Next.js (páginas, rutas API, proxy/CSP), migraciones SQL de Supabase, integración Wompi y experiencia de compra. Cada hallazgo indica severidad, impacto y corrección aplicada.

## Hallazgos corregidos

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alta | El panel no mostraba los productos de cada pedido: no había forma de saber qué empacar. | La consulta del panel incluye los renglones, molienda, dirección, documento y datos de pago. |
| 2 | Alta | La ciudad se escribía a mano y debía coincidir exactamente con la tarifa (“Bogotá D.C.” ≠ “bogota”): pedidos rechazados sin motivo claro. | El cliente elige su ciudad de las tarifas activas (función pública de solo lectura) y ve el domicilio y el total antes de pagar. |
| 3 | Alta | La confirmación del pago dependía solo del webhook; el cliente volvía de Wompi a una página “esperando pago”. | Al volver con `?id=` se consulta la transacción con la llave privada y se concilia de inmediato (la referencia debe coincidir). Se mantiene el webhook. |
| 4 | Alta | Las tipografías nunca se aplicaban: las variables de `next/font` estaban en `<body>` y se consumían en `:root`, así que toda la tienda salía en la serif por defecto del navegador. | Variables en `<html>`; fuentes alojadas en el proyecto (el build ya no depende de Google Fonts). |
| 5 | Media | Editar la bolsa después de crear el pedido dejaba unidades reservadas 35 minutos; tras pagar, la bolsa seguía llena. | Endpoint `/api/checkout/cancel` (con el token del cliente) libera la reserva; la bolsa se vacía al ir a pagar y queda un aviso con el enlace de seguimiento. |
| 6 | Media | El panel no podía cancelar pedidos, registrar reembolsos ni cerrar la alerta de pago duplicado (la métrica quedaba en rojo para siempre). | Funciones `admin_close_order` y `admin_resolve_payment_review` con auditoría en el historial interno. |
| 7 | Media | Despachar exigía un enlace HTTPS de rastreo: los domicilios en moto sin guía no se podían marcar como enviados. | Transportadora, guía y enlace opcionales (el enlace, si existe, debe ser HTTPS; también lo valida una restricción en la base). |
| 8 | Media | Supabase concede privilegios por defecto a `anon`/`authenticated`; `revoke … from public` sobre la vista del catálogo no los retiraba. No era explotable (vista no actualizable), pero el linter la marca como vista con privilegios del propietario. | La vista se reemplazó por funciones `security definer` de solo lectura (`storefront_catalog_items`, `storefront_shipping_zones`) con permisos explícitos. Se retiran privilegios de `anon` sobre tablas privadas. |
| 9 | Media | Varias funciones comparaban `auth.role() <> 'service_role'`; con rol nulo la condición no se cumple y la función continúa. Solo era alcanzable por roles de confianza porque `EXECUTE` estaba revocado. | Todas usan `is distinct from` (o permiten explícitamente solo el rol nulo de tareas internas). |
| 10 | Media | La conciliación actualizaba inventario en orden arbitrario: posibles bloqueos mutuos con pagos simultáneos. | Bloqueos en orden estable por presentación en conciliación, cancelación, vencimiento y reembolso. |
| 11 | Media | Next.js memoiza `fetch` GET idénticos durante un render: después de conciliar un pago, la segunda lectura del pedido devolvía el estado viejo. | Cliente de servicio con `fetch` sin caché y con señal propia (sin memoización). |
| 12 | Media | Webhooks de referencias ajenas a la tienda respondían 409 y Wompi reintentaba tres veces. | Responde 200 y registra el evento en el log; los errores reintentables siguen respondiendo 5xx. |
| 13 | Baja | La CSP permitía `connect-src https://*.supabase.co` aunque el navegador no habla con Supabase. | `connect-src 'self'`; se añaden `Cross-Origin-Opener-Policy` y una `Permissions-Policy` más estricta. |
| 14 | Baja | Celular validado con un patrón laxo; Nequi y Wompi esperan 10 dígitos. | Normalización a celular colombiano (`3XXXXXXXXX`, admite `+57`), validada también en la base. |
| 15 | Baja | Los errores del checkout aparecían en un aviso con ícono de éxito, duplicados en dos regiones `role=status`. | Avisos con tono (éxito, información, error) y un solo anuncio accesible. |
| 16 | Baja | Cambiar de presentación reiniciaba la molienda elegida; volver de los datos de entrega a la bolsa borraba el formulario. | La molienda se conserva si existe en la nueva presentación; el formulario vive en el estado de la tienda. |
| 17 | Baja | La métrica de “pocas unidades” contaba presentaciones sin precio confirmado. | Solo cuenta presentaciones publicadas, activas y con precio confirmado. |
| 18 | Baja | Sin términos de compra (identidad del vendedor, retracto, reversión del pago, Ley 1480 y Decreto 587 de 2016). | Borrador en `/terminos` enlazado desde el checkout y el pie. |
| 19 | Baja | `priority` de `next/image` está obsoleto en Next.js 16; número de WhatsApp y formato de moneda duplicados en varios archivos. | `preload`; datos del comercio en `lib/site.ts` y variables `NEXT_PUBLIC_*`. |

## Controles verificados

- Rutas que cambian estado: `Origin` igual a `NEXT_PUBLIC_SITE_URL` (403 sin origen o con origen ajeno), `Content-Type: application/json` (415), tamaño máximo y esquema estricto (400).
- Panel: sesión de Supabase validada con el servidor de Auth (`getUser`) y rol `admin` en `app_metadata`; una cuenta sin rol no entra.
- Webhook: firma inválida, ambiente cruzado y eventos de más de 48 h responden 401; un evento repetido no se aplica dos veces; si el monto del evento no coincide con la API de Wompi responde 409.
- Checkout: el navegador no envía precios; total, domicilio, molienda e inventario se validan dentro de una transacción con bloqueo por fila. Límite de 8 pedidos por hora por IP y 3 contra entrega por celular al día.
- Seguimiento: token de 256 bits, solo su hash en la base, sin datos personales en la página, `noindex` y `no-store`.

## Pruebas ejecutadas

- `tests/sql/functions.test.sql` contra PostgreSQL 16 con el entorno de Supabase simulado: 20 verificaciones de permisos y reglas de negocio.
- Recorrido completo con navegador sobre la app compilada en modo producción, detrás de HTTPS, con PostgREST real y la API de Wompi simulada: alta de ciudades, precios, presentación nueva e inventario desde el panel; compra con Wompi (firma de integridad verificada, prellenado, retorno con conciliación inmediata); compra contra entrega (ciudad sin contra entrega, tope de monto); pago abandonado, reintento con la misma referencia y cancelación por el cliente; webhooks aprobado, rechazado, repetido y adulterado; confirmación, despacho sin guía, entrega con recaudo y reembolso con devolución de inventario desde el panel; límite de solicitudes.
- Revisión visual en escritorio (1440 px) y móvil (390 px).

## Pendientes recomendados

1. **Correo de confirmación al cliente** con el enlace de seguimiento (hoy se muestra en pantalla y queda guardado en el navegador; Wompi envía su comprobante de pago, pero no el enlace de la tienda).
2. **MFA para la cuenta administradora** (Supabase Auth, nivel AAL2) y registro público desactivado.
3. **Tareas programadas** de `expire_checkout_orders` y `prune_store_rate_limits` (ver README).
4. **Factura electrónica:** el checkout ya recoge tipo y número de documento cuando el cliente la pide; falta conectar el proveedor tecnológico.
5. **Textos legales definitivos** en `/privacidad` y `/terminos` y validación del alcance del retracto para café molido a la medida.
6. **Monitoreo y respaldo:** alertas de errores en el webhook y respaldo con restauración a un punto en el tiempo en Supabase.
7. **Etiquetas definitivas** para Lavado, Natural, Honey Red y Honey Black (las actuales son ilustrativas).
