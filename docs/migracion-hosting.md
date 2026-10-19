# Migración a un hosting con servidor

GitHub Pages solo sirve archivos estáticos, y sus términos no permiten usarlo para operar una tienda en línea. Hoy publica el **modo catálogo** (pedidos por WhatsApp). Para cobrar en línea hay que publicar el **modo aplicación completa** en un hosting compatible con Next.js 16. Este documento prepara esa migración. **No activa pagos ni despliega nada**: cada paso con efecto real necesita la aprobación del propietario.

## Los dos modos

| | Modo catálogo (hoy, GitHub Pages) | Modo aplicación completa (Netlify u otro) |
|---|---|---|
| Build | `npm run build:pages` (exportación estática) | `npm run build` (Next.js con servidor) |
| Catálogo | Leído de Supabase en cada build (cada 6 h o a mano) | Leído en cada visita |
| Bolsa | Sí; termina en un mensaje de WhatsApp | Sí; termina en el checkout |
| Pago con Wompi y contra entrega | No | Sí, cuando `STORE_CHECKOUT_ENABLED=true` y todo está listo |
| Pedidos guardados, seguimiento privado | No | Sí |
| Panel `/admin` | Solo en local (`npm run dev`) | En línea, con sesión de administrador |
| Webhooks de Wompi | No | `/api/webhooks/wompi` |
| Seguridad | CSP con hashes por página (meta) | CSP con nonce, cabeceras HSTS, COOP, etc. |
| Archivos `*.server.ts(x)` | Se omiten | Se incluyen |

## Hosting recomendado: Netlify

- Netlify publica Next.js 13.5+ (incluido 16) sin configuración, con su adaptador OpenNext. El proxy de Next.js corre como función de Netlify; las rutas API y las páginas dinámicas, como funciones del servidor.
- Antes de decidir, revisa en netlify.com el plan vigente, sus límites (ancho de banda, minutos de build, invocaciones de funciones) y sus condiciones de uso comercial. Los planes y precios cambian, así que esta guía no los fija.
- Alternativas: Vercel (su plan Hobby prohíbe el uso comercial; se requiere Pro) o un contenedor Node (`next start`) en un servidor propio.

## Pasos

1. **Cuenta y sitio.** Crea el sitio en Netlify desde el repositorio `mibernal/Cafe-Do-a-Tere`, rama `main`. `netlify.toml` ya define `npm run build` y Node 22. Desactiva los *deploy previews* de ramas o mantenlos sin variables de producción.
2. **Variables de entorno** (*Site configuration → Environment variables*). Marca como secretas las que lo son y nunca les pongas el prefijo `NEXT_PUBLIC_`.

   | Variable | Tipo | Nota |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | pública | URL del proyecto |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública | llave publicable `sb_publishable_…` |
   | `SUPABASE_SERVICE_ROLE_KEY` | **secreta** | llave `sb_secret_…`, solo servidor |
   | `RATE_LIMIT_SECRET` | **secreta** | aleatoria, 32+ bytes |
   | `CLIENT_IP_HEADER` | configuración | `x-nf-client-connection-ip` en Netlify |
   | `NEXT_PUBLIC_SITE_URL` | pública | origen HTTPS exacto, sin ruta (p. ej. `https://cafedonatere.co`) |
   | `WOMPI_ENVIRONMENT` | configuración | `test` primero |
   | `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | **secretas** (salvo la pública) | del mismo ambiente |
   | `CASH_ON_DELIVERY_ENABLED`, `CASH_ON_DELIVERY_MAX_COP` | configuración | contra entrega |
   | `BUSINESS_LEGAL_NAME`, `BUSINESS_TAX_ID`, `BUSINESS_ADDRESS`, `BUSINESS_LEGAL_EMAIL` | públicas | ver `docs/datos-pendientes.md` |
   | `PRIVACY_POLICY_VERSION` | configuración | versión publicada, sin la palabra `draft` |
   | `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_INSTAGRAM_URL` | públicas | contacto |
   | `STORE_CHECKOUT_ENABLED` | configuración | **`false`** hasta aprobar el checklist |

3. **Primer despliegue con pagos cerrados** (`STORE_CHECKOUT_ENABLED=false`) en la URL de Netlify. Verifica:
   - la portada y el catálogo vivo;
   - el inicio de sesión en `/admin` y el **Estado de la tienda**;
   - que `/api/webhooks/wompi` responda 401 sin firma;
   - las cabeceras de seguridad (CSP con nonce, HSTS);
   - que `/seguimiento/<token-inventado>` dé 404.
4. **Dominio.** Conecta el dominio definitivo con HTTPS y actualiza `NEXT_PUBLIC_SITE_URL`. Con dominio raíz, la tienda no lleva subdirectorio.
5. **Wompi en pruebas.** Carga las llaves de pruebas y registra en Wompi la URL de eventos `https://<dominio>/api/webhooks/wompi`. Activa `STORE_CHECKOUT_ENABLED=true` solo en el ambiente de pruebas y haz:
   - una compra aprobada;
   - una rechazada;
   - una abandonada y luego reintentada;
   - un pedido contra entrega;
   - un reembolso registrado en el panel.
6. **Producción**, solo con la aprobación del propietario: llaves de producción de Wompi, `WOMPI_ENVIRONMENT=production`, checklist de abajo completo y `STORE_CHECKOUT_ENABLED=true`.
7. **GitHub Pages.** No se desactiva hasta que el nuevo hosting esté aprobado. Después se reemplaza por una página que enlace al dominio nuevo, o se apaga en *Settings → Pages*.

## Reversión

- Cerrar pagos de inmediato: `STORE_CHECKOUT_ENABLED=false` y *Redeploy*. La tienda vuelve al modo WhatsApp sin perder pedidos.
- Volver a una versión anterior: en Netlify, *Deploys → (deploy anterior) → Publish deploy*.
- Volver al sitio estático: GitHub Pages sigue activo hasta que se apruebe la migración. Si el dominio ya apunta a Netlify, se devuelve el DNS o se publica el catálogo estático en Netlify con `npm run build:pages` y `publish = "out"`.
- La base de datos no cambia con la migración: las mismas migraciones y la misma instancia de Supabase sirven a ambos modos.

## Checklist de aprobación para producción

- [ ] Datos legales completos y textos revisados por un asesor (`docs/datos-pendientes.md`); el panel muestra **Datos legales completos**.
- [ ] `PRIVACY_POLICY_VERSION` publicada.
- [ ] Precios confirmados e inventario cargado en las presentaciones a la venta.
- [ ] Ciudades y tarifas de domicilio activas; contra entrega solo donde aplique.
- [ ] Llaves de Wompi de producción del mismo ambiente; URL de eventos registrada.
- [ ] Compras de prueba aprobadas, rechazadas y abandonadas verificadas en el ambiente de pruebas.
- [ ] Cuenta de administrador con rol `admin` en `app_metadata`; registro público desactivado en Supabase Auth; MFA recomendado.
- [ ] Tareas programadas de Supabase (`expire_checkout_orders`, `prune_store_rate_limits`) creadas con `pg_cron`.
- [ ] `RATE_LIMIT_SECRET` y `CLIENT_IP_HEADER` configurados.
- [ ] Llaves legacy de Supabase desactivadas y llave secreta rotada si se compartió.
- [ ] Respaldo de la base (PITR o export) y alertas de errores del webhook.
- [ ] Aprobación explícita del propietario.
