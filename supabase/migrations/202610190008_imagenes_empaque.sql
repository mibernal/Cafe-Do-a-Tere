-- =====================================================================
-- 008 · Imágenes de producto empacado
--
-- Cada presentación muestra su bolsa con la etiqueta aplicada
-- (public/assets/pack-*.png, generadas con scripts/packaging/): la referencia,
-- el peso y la molienda correctos. Las variantes que venden "En grano"
-- reciben además la bolsa con la etiqueta en grano.
--
-- Solo se reemplazan imágenes que la tienda puso por defecto (la etiqueta
-- plana, las fotos iniciales o la foto del café que copia una presentación
-- nueva creada en /admin); una imagen elegida a mano no se toca.
-- =====================================================================

create temporary table pack_images (product_id text, weight_grams integer, image_url text, bean_image_url text);

insert into pack_images values
  ('lena', 250, '/assets/pack-lena-250.png', null),
  ('lena', 500, '/assets/pack-lena-500-ground.png', '/assets/pack-lena-500-beans.png'),
  ('precision', 250, '/assets/pack-precision-250.png', null),
  ('precision', 500, '/assets/pack-precision-500.png', null),
  ('honey-red', 250, '/assets/pack-honey-red-250.png', '/assets/pack-honey-red-250-beans.png'),
  ('honey-red', 500, '/assets/pack-honey-red-500.png', '/assets/pack-honey-red-500-beans.png'),
  ('honey-black', 250, '/assets/pack-honey-black-250.png', '/assets/pack-honey-black-250-beans.png'),
  ('honey-black', 500, '/assets/pack-honey-black-500.png', '/assets/pack-honey-black-500-beans.png'),
  ('lavado', 250, '/assets/pack-lavado-250.png', '/assets/pack-lavado-250-beans.png'),
  ('lavado', 500, '/assets/pack-lavado-500.png', '/assets/pack-lavado-500-beans.png'),
  ('natural', 250, '/assets/pack-natural-250.png', '/assets/pack-natural-250-beans.png'),
  ('natural', 500, '/assets/pack-natural-500.png', '/assets/pack-natural-500-beans.png');

update public.product_variants v
set image_url = pi.image_url, updated_at = now()
from pack_images pi, public.products p
where v.product_id = pi.product_id
  and v.weight_grams = pi.weight_grams
  and p.id = v.product_id
  and (
    v.image_url is null
    or v.image_url like '/assets/cafe-%-front.jpg'
    or v.image_url in ('/assets/classic-250.jpg', '/assets/classic-500-ground.jpg', '/assets/classic-500-beans.jpg', '/assets/precision-500.jpg')
    or v.image_url = p.image_url
  );

update public.product_variants v
set bean_image_url = pi.bean_image_url, updated_at = now()
from pack_images pi
where v.product_id = pi.product_id
  and v.weight_grams = pi.weight_grams
  and pi.bean_image_url is not null
  and v.grinds @> array['En grano']
  and (v.bean_image_url is null or v.bean_image_url like '/assets/cafe-%-front.jpg');

drop table pack_images;
