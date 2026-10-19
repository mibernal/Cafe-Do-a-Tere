## Revisión de "Elegir café" · 18 de octubre de 2026

Catálogo vigente: **Tostado a la leña**, **Tostión de precisión** y el microlote **Honey Red**. Supuesto aplicado: el "microlote" de la finca es el Honey Red; el "Microlote Honey" genérico queda oculto.

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | La tienda mostraba siete cafés, cuatro sin lote (Lavado, Natural, Honey Black, Microlote Honey). | Migración `202610190005_catalogo_vigente.sql`: deja publicados solo los tres vigentes y en ese orden. No oculta un café al que ya se le confirmó precio o cargó inventario, y no pisa textos editados desde el panel. |
| 2 | El asistente "¿No sabes cuál elegir?" podía recomendar un café en una molienda que no ofrece (p. ej. "Lo muelo en casa" con un café sin presentación en grano) y explicaba "te lo enviamos en grano" mientras dejaba seleccionado Espresso. | Recomendación por puntaje con perfil de taza por café (`lib/coffee-profiles.ts`); penaliza moliendas no disponibles y solo da razones ciertas. Sin método elegido, sugiere la molienda donde ese café mejor se expresa. |
| 3 | No había forma de comparar los cafés entre sí. | Sección "Tres cafés, lado a lado" (intensidad, acidez, cuerpo, dulzor, notas, con o sin leche, métodos y precio). En el teléfono los tres caben sin desplazar la tabla. |
| 4 | Menú, portada, cinta de variedades, preguntas frecuentes y el espectro de procesos estaban escritos para siete cafés. | Todo se arma con los cafés publicados: el menú solo enlaza secciones que existen, el espectro de procesos se muestra con tres procesos o más y las preguntas frecuentes describen los cafés vigentes. |
| 5 | Una bolsa guardada con un café que dejó de publicarse se vaciaba en silencio; el checkout respondía "aún no tiene precio confirmado" para un café oculto. | Aviso "Retiramos de tu bolsa un café que ya no está disponible" y mensaje propio en el checkout. |

Verificado: 21 verificaciones SQL (incluye que un café oculto no se puede comprar aunque tenga precio), compra Wompi y contra entrega de punta a punta con el catálogo nuevo, webhooks, reembolso, límites, y revisión visual en 1440 px y 390 px. Publicar de nuevo una variedad desde `/admin` la muestra en catálogo, comparación, asistente y menú sin tocar código.

Pendiente: validar con catación de la finca las escalas de 1 a 5 de `lib/coffee-profiles.ts` (son de referencia) y las notas de taza del Honey Red, que hoy describen el perfil (dulce y redondo, cuerpo medio-alto, acidez media) y se editan desde `/admin`.
