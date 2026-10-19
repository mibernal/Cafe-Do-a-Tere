-- =====================================================================
-- 006 · Altura confirmada de Finca La Libertad
--
-- El comercio confirmó que la finca está entre 1.450 y 1.650 m s. n. m.
-- (variedades Castillo 60 % y Caturra 40 %, clasificación excelso; estos
-- datos de la finca viven en lib/site.ts). Aquí solo se completa la altura de
-- los cafés de la finca que siguen con el texto inicial "Altura por
-- confirmar", para no pisar lo que se haya editado desde /admin.
-- =====================================================================

update public.products
set altitude = '1.450–1.650 m s. n. m.', updated_at = now()
where origin ilike 'Finca La Libertad%'
  and altitude in ('Altura por confirmar', 'Por confirmar');
