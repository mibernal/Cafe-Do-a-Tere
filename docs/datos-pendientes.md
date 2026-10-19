# Datos que debe aportar el comercio

La tienda no inventa datos del negocio, del café ni legales. Esta lista reúne lo que falta. Cada punto dice dónde se configura.

## 1. Documentos legales

Mientras falte cualquiera de estos datos o textos, `/terminos` y `/privacidad` se publican con el aviso de borrador y los campos marcados como **Pendiente**. Además, no se indexan en buscadores y el pago en línea queda cerrado (el panel lo muestra en **Estado de la tienda**).

Datos del responsable: los publicó el comercio y viven en `lib/legal.ts` (`MERCHANT`). Una variable de entorno con el mismo nombre los reemplaza (`.env.local`, hosting o *Variables* de GitHub Actions).

| Dato | Variable | Estado |
|---|---|---|
| Nombre del responsable | `BUSINESS_LEGAL_NAME` | Completo |
| NIT o cédula | `BUSINESS_TAX_ID` | Completo |
| Dirección de notificaciones | `BUSINESS_ADDRESS` | Completo (Bogotá) |
| Correo de atención y de datos personales | `BUSINESS_LEGAL_EMAIL` | Completo |

Textos:

| Contenido | Archivo | Estado |
|---|---|---|
| Impuestos | `app/terminos/page.tsx` | Completo: precio final, no se suman impuestos |
| Medios de pago al confirmar por WhatsApp | `app/terminos/page.tsx` | Completo: Bre-B y Nequi |
| Envíos | `app/terminos/page.tsx` | Completo: Bogotá hasta 48 horas; otras ciudades se confirman por WhatsApp; aplican las políticas de la transportadora |
| Tiempo de conservación de los datos | `app/privacidad/page.tsx` | Completo: cinco años |
| Alcance del retracto para alimentos y café molido a la medida | `app/terminos/page.tsx` | **Pendiente** |
| Encargados reales del tratamiento de datos | `app/privacidad/page.tsx` | **Pendiente** |

Cuando un texto pendiente quede definitivo, se reemplaza el marcador en la página y se quita su entrada de `PENDING_LEGAL_CONTENT` en `lib/legal.ts`.

Puntos para revisión profesional: retracto y sus excepciones (Ley 1480 de 2011, Decreto 587 de 2016), reversión del pago, garantía, autorización y finalidades del tratamiento de datos (Ley 1581 de 2012, Decreto 1377 de 2013) y la versión publicada de la política (`PRIVACY_POLICY_VERSION`). Los textos actuales son un borrador de trabajo: no son definitivos ni garantizan cumplimiento normativo.

## 2. Precios e inventario

- Ninguna presentación tiene precio fijado en el código. Los precios se confirman en el panel `/admin` (Catálogo) y el inventario en *Inventario*.
- Mientras un precio no esté confirmado, la tienda muestra «Precio por confirmar», no lo incluye en subtotales, mensajes ni datos estructurados, y el pedido se termina por WhatsApp.

## 3. Café y finca

| Dato | Estado en la tienda | Qué falta |
|---|---|---|
| Variedades: Castillo 60 % · Caturra 40 % | Confirmada por el comercio; publicada en el origen, en la ficha de cada café y en los datos estructurados | Si un lote tiene otra composición, pasar el dato a ese café |
| Especie: arábica | Publicada (sale de la etiqueta) | — |
| Clasificación: excelso | Confirmada por el comercio; publicada como clasificación | — |
| Altura 1.450–1.650 m s. n. m. | Confirmada por el comercio; publicada en los tres cafés (migración 006) | — |
| Proceso de beneficio de Tostado a la leña y Tostión de precisión | No se publica | Lavado, honey o natural, según el lote |
| Honey Red como «microlote de la finca» | Publicado | Confirmar que el Honey Red es el microlote |
| Escalas de intensidad, acidez, cuerpo y dulzor | Publicadas como orientativas, revisadas con la investigación de `docs/perfiles-de-taza.md` | Ajustarlas con la catación de cada lote en `lib/coffee-profiles.ts` |
| Notas de taza del Honey Red | Describen el perfil («dulce y redondo, cuerpo medio-alto, acidez media») | Notas de sabor reales; se editan en `/admin` |
| Nombre comercial de la tostión de precisión | La tienda dice «Tostión de precisión»; la etiqueta, «Tostado en precisión» | Elegir un nombre y usarlo en ambos |

La tienda no publica puntajes SCA, certificaciones, premios, reseñas, testimonios ni beneficios de salud.

## 4. Etiquetas e imágenes

Cada presentación se muestra como su bolsa empacada (`public/assets/pack-*.png`), con la etiqueta, el peso y la molienda de esa opción: al elegir «En grano» la tienda cambia a la bolsa con la etiqueta en grano. Cómo se generan: `scripts/packaging/README.md`.

Las etiquetas de Tostado a la leña (250 g, 500 g molido y 500 g en grano) y de Tostión de precisión (500 g) son las originales del comercio. Las demás son ilustrativas y la tienda las muestra con el aviso «Empaque ilustrativo»:

| Etiqueta ilustrativa | De dónde sale |
|---|---|
| `cafe-precision-250-front.jpg` | Tostión de precisión 500 g con el peso de 250 g |
| `cafe-honey-red-340-front.jpg`, `cafe-honey-red-340-beans-front.jpg` | Honey Red 250 g con el peso de 340 g |
| `cafe-honey-red-*`, `cafe-honey-black-*`, `cafe-lavado-*`, `cafe-natural-*` (250 g y 500 g) | Etiqueta de Tostión de precisión con la cinta del proceso |
| `cafe-*-beans-front.jpg` de esos cafés | La anterior con el ícono, la celda y el pie «en grano» de la etiqueta original de Tostado a la leña 500 g en grano |

Para publicar la definitiva: reemplaza la etiqueta con el mismo nombre (420 × 580 px), vuelve a generar su bolsa y quita su nombre de `ILLUSTRATIVE_PACKS` en `lib/provisional-assets.ts`.

La bolsa (kraft con válvula y zip) es una representación: si el empaque real es distinto, se ajusta en `scripts/packaging/packshots.py` y se regeneran las imágenes.

## 5. Pago en línea (cuando se migre a un hosting con servidor)

Llaves de Wompi de la cuenta del comercio (hoy son valores de ejemplo), ciudades y tarifas de domicilio en `/admin`, `PRIVACY_POLICY_VERSION` publicada y los puntos 1 y 2 completos. Ver `docs/migracion-hosting.md`.
