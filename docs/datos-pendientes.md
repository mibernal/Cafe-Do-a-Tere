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

Las etiquetas de Honey Red, Honey Black, Lavado y Natural son ilustrativas: se generaron a partir de la etiqueta de Tostión de precisión. La tienda no las muestra; en su lugar usa la foto del café. Para publicar la definitiva:

1. Reemplaza el archivo en `public/assets/` con el mismo nombre (420 × 580 px, JPG).
2. Quita la ruta de `PROVISIONAL_LABELS` en `lib/provisional-assets.ts`.

| Archivo esperado | Café |
|---|---|
| `public/assets/cafe-precision-250-front.jpg` | Tostión de precisión 250 g (creada en el panel; mientras falte, se muestra la foto del café) |
| `public/assets/cafe-honey-red-250-front.jpg` | Honey Red 250 g |
| `public/assets/cafe-honey-red-500-front.jpg` | Honey Red 500 g |
| `public/assets/cafe-honey-black-250-front.jpg`, `-500-front.jpg` | Honey Black (oculto) |
| `public/assets/cafe-lavado-250-front.jpg`, `-500-front.jpg` | Lavado (oculto) |
| `public/assets/cafe-natural-250-front.jpg`, `-500-front.jpg` | Natural (oculto) |

Las etiquetas de Tostado a la leña (250 g y 500 g) y de Tostión de precisión (500 g) son las originales del comercio.

## 5. Pago en línea (cuando se migre a un hosting con servidor)

Llaves de Wompi de la cuenta del comercio (hoy son valores de ejemplo), ciudades y tarifas de domicilio en `/admin`, `PRIVACY_POLICY_VERSION` publicada y los puntos 1 y 2 completos. Ver `docs/migracion-hosting.md`.
