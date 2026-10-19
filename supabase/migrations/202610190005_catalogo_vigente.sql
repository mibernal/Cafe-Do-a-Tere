-- =====================================================================
-- 005 · Catálogo vigente de la finca
--
-- Hoy se venden tres cafés: Tostado a la leña, Tostión de precisión y el
-- microlote Honey Red. Lavado, Natural, Honey Black y el "Microlote Honey"
-- genérico quedan creados pero ocultos; se publican desde /admin cuando haya
-- lote. Las actualizaciones solo tocan registros que siguen con los valores
-- iniciales, para no pisar cambios hechos desde el panel.
-- =====================================================================

-- Oculta las variedades sin lote, salvo que el comercio ya les haya
-- confirmado precio o cargado inventario.
update public.products p
set is_published = false, updated_at = now()
where p.id in ('honey', 'lavado', 'natural', 'honey-black')
  and p.is_published
  and not exists (
    select 1 from public.product_variants v
    where v.product_id = p.id and (v.price_confirmed or v.stock_on_hand > 0)
  );

-- El Honey Red es el microlote de la finca: hereda el perfil documentado
-- (cuerpo medio-alto, acidez media) en lugar del texto genérico de 004.
update public.products
set subtitle = 'Microlote de la finca',
    description = 'Un lote pequeño de la finca en proceso honey: conservamos buena parte del mucílago y secamos el grano con calma. Una taza dulce y redonda, de cuerpo medio-alto y acidez media.',
    notes = array['Dulce y redondo', 'Cuerpo medio-alto', 'Acidez media'],
    badge = 'Microlote',
    sort_order = 3,
    updated_at = now()
where id = 'honey-red'
  and subtitle = 'Dulzor profundo, secado pausado';

-- Orden de la vitrina: leña, precisión, Honey Red; las ocultas después.
update public.products set sort_order = 1, updated_at = now() where id = 'lena' and sort_order <> 1;
update public.products set sort_order = 2, updated_at = now() where id = 'precision' and sort_order <> 2;
update public.products set sort_order = 10, updated_at = now() where id = 'honey' and not is_published and sort_order = 3;
