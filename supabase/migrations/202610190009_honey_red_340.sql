-- =====================================================================
-- 009 · Bolsa de Honey Red 340 g
--
-- La presentación de 340 g de Honey Red (creada en /admin) apunta a la
-- etiqueta o la foto por defecto. Aquí recibe su bolsa de 340 g, molida y en
-- grano. Igual que la 008, no toca una imagen elegida a mano.
-- =====================================================================

update public.product_variants v
set image_url = '/assets/pack-honey-red-340.png', updated_at = now()
from public.products p
where p.id = v.product_id
  and v.product_id = 'honey-red'
  and v.weight_grams = 340
  and (
    v.image_url is null
    or v.image_url like '/assets/cafe-%-front.jpg'
    or v.image_url like '/assets/pack-honey-red-%.png'
    or v.image_url = p.image_url
  );

update public.product_variants
set bean_image_url = '/assets/pack-honey-red-340-beans.png', updated_at = now()
where product_id = 'honey-red'
  and weight_grams = 340
  and grinds @> array['En grano']
  and (bean_image_url is null or bean_image_url like '/assets/cafe-%-front.jpg' or bean_image_url like '/assets/pack-honey-red-%.png');
