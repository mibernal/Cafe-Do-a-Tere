# Perfiles de taza: de dónde salen

La comparación «lado a lado» y el asistente «Ayúdame a elegir» usan una escala orientativa de 1 a 5 (`lib/coffee-profiles.ts`). La finca la define para comparar sus propios cafés. **No es una catación certificada ni un puntaje SCA**, y la tienda lo dice así. Este documento explica cómo se fijó cada valor y qué falta para convertirlo en dato de catación.

## Datos de la finca (confirmados por el comercio)

| Dato | Valor | Dónde vive |
|---|---|---|
| Finca | La Libertad, Cachipay (Cundinamarca), cerca de 4,7° N | `lib/site.ts` |
| Altura | 1.450–1.650 m s. n. m. | `lib/site.ts` y `products.altitude` (migración 006) |
| Especie | Arábica | `lib/site.ts` |
| Variedades | Castillo 60 % · Caturra 40 % | `lib/site.ts` (`site.varieties`) |
| Clasificación | Excelso | `lib/site.ts` |

Las variedades se publican a nivel de finca y aparecen en la ficha de cada café de La Libertad. Si un lote llega a tener otra composición (por ejemplo, un microlote de una sola variedad), hay que pasar el dato a cada café.

## Qué dice la investigación

1. **La variedad no cambia la calidad, sí algunos matices.** Cenicafé liberó el Castillo en 2005, a partir de Caturra × Híbrido de Timor, y no encontró diferencias de calidad en taza frente al Caturra. La cata a ciegas de Catholic Relief Services con World Coffee Research (Nariño, cosecha 2014) tampoco halló diferencias significativas en los puntajes. Los catadores sí describieron distinto las buenas muestras: el Castillo, «frutal pero no cítrico», con chocolate oscuro y nueces tostadas; el Caturra, floral, con cacao y caramelo. La FNC atribuye las diferencias de calidad sobre todo al ambiente, no a la genética.
2. **La altura de la finca es media-alta.** Para el Caturra, World Coffee Research ubica la altura óptima por encima de 1.600 m entre 5° N y 5° S. La finca (1.450–1.650 m) está en el borde inferior de ese rango: es de esperar una acidez presente, pero no la más brillante de Colombia.
3. **La tostión mueve la acidez y el amargor.** En un estudio publicado por la SCA, al oscurecer la tostión bajó la acidez y subió el amargor. El dulzor no cambió de forma significativa, y el cuerpo subió al principio pero no siguió una línea recta.
4. **El proceso honey redondea la taza.** Frente a un lavado, los honey muestran acidez más redonda y menos cítrica, más cuerpo y más dulzor, a veces con notas de chocolate (Coffee Review).

**Conclusión.** Los tres cafés de la casa comparten finca, altura y variedades. Lo que los separa en la escala es la tostión (leña o media) y el proceso (honey). Las notas que la finca ya describe encajan con sus variedades: el cacao y los frutos secos del Tostado a la leña son los matices típicos del Castillo.

## Valores actuales y por qué

| Café | Intensidad | Acidez | Cuerpo | Dulzor | Razón |
|---|---|---|---|---|---|
| Tostado a la leña | 5 | 2 | 4 | 3 | La tostión más desarrollada: acidez baja (la finca solo describe «una nota cítrica suave»), más amargor de cacao oscuro, cuerpo alto. Se sostiene con leche. |
| Tostión de precisión | 3 | 4 | 3 | 4 | Tostión media: conserva la acidez de la altura (la más viva de los tres), con dulzor de panela. Va mejor en filtro. |
| Honey Red | 3 | 3 | 4 | 5 | El honey redondea la acidez (media, según la finca), sube el cuerpo (medio-alto) y da el mayor dulzor. Menos cítrico que la precisión, con fondo achocolatado. |

Cambios frente a la versión anterior:

- **Tostión de precisión:** más afinidad con «Dulce y redondo» (panela, chocolate con leche). Su frase destaca que es la más luminosa.
- **Honey Red:** ya no aparece como opción cítrica. Ahora suma afinidad con «Chocolate y cacao», porque el honey resta brillo cítrico. Su frase destaca que es la más dulce y redonda.
- **Tostado a la leña:** sin cambios en la escala. Su frase ahora atribuye el final ahumado a la leña.
- La comparación explica que los cafés comparten finca, altura y variedades.

## Pendiente para pasar de orientativo a catación

- Catar cada lote (idealmente con un catador Q o un laboratorio) y ajustar los valores en `lib/coffee-profiles.ts`.
- Notas de sabor reales del Honey Red (hoy describen el perfil, no sabores). Se editan en `/admin`.
- Confirmar el grado de la tostión a la leña y el proceso de beneficio del Tostado a la leña y de la Tostión de precisión.

## Fuentes

- Cenicafé, *Variedad Castillo®* (Avance Técnico 426): https://biblioteca.cenicafe.org/bitstream/10778/410/1/avt0426.pdf
- Global Coffee Report, *The FNC weighs in on the Castillo vs Caturra debate*: https://www.gcrmag.com/the-fnc-weighs-in-on-the-castillo-vs-caturra-debate
- Daily Coffee News (CRS Coffeelands), resultados de la cata Castillo vs Caturra: https://dailycoffeenews.com/?p=45320
- World Coffee Research, ficha de Caturra: https://varieties.worldcoffeeresearch.org/varieties/caturra
- SCA, *Modulating Perception* (25 Magazine, número 5): https://sca.coffee/sca-news/25-magazine/issue-5/modulating-perception-25-magazine-issue-5
- Coffee Review, *Honey and Pulped Natural Coffees*: https://www.coffeereview.com/honey-and-pulped-natural-coffees/
