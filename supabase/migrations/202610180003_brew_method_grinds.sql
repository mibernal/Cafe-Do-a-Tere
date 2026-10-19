-- Commercial grind options by preparation method. Only variants still using the
-- original seed values are expanded, so merchant-specific configurations stay intact.
update public.product_variants
set grinds = array[
  'Espresso · fina',
  'Cafetera italiana (Moka) · media',
  'V60 / filtro manual · media',
  'Cafetera eléctrica · media-fina',
  'Chemex · media-gruesa',
  'Prensa francesa · gruesa',
  'AeroPress · media-fina',
  'Cold brew · media-gruesa'
] || case when 'En grano' = any(grinds) then array['En grano'] else '{}'::text[] end,
    image_url = case id
      when 'lena-250' then '/assets/cafe-lena-250-front.jpg'
      when 'lena-500' then '/assets/cafe-lena-500-ground-front.jpg'
      when 'precision-500' then '/assets/cafe-precision-500-front.jpg'
      when 'honey-340' then '/assets/cafe-honey-beans-closeup.jpg'
      else image_url
    end,
    updated_at = now()
where id in ('lena-250', 'lena-500', 'precision-500', 'honey-340')
  and grinds <@ array['Molido', 'En grano']::text[]
  and 'Molido' = any(grinds);

drop function if exists public.admin_configure_variant(text, text, integer, integer, boolean, uuid);

create function public.admin_configure_variant(
  p_variant_id text,
  p_label text,
  p_weight_grams integer,
  p_price_cop integer,
  p_price_confirmed boolean,
  p_grinds text[],
  p_admin_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_variant public.product_variants%rowtype;
  v_previous jsonb;
  v_next jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if length(trim(p_label)) < 2 or length(p_label) > 60
    or p_weight_grams < 50 or p_weight_grams > 20000
    or p_price_cop < 0 or p_price_cop > 100000000 then
    raise exception 'invalid variant values';
  end if;
  if p_price_confirmed and p_price_cop = 0 then
    raise exception 'confirmed price must be positive';
  end if;
  if p_grinds is null or cardinality(p_grinds) < 1 or cardinality(p_grinds) > 9
    or exists (
      select 1
      from unnest(p_grinds) as selected_grind(value)
      where selected_grind.value not in (
        'Espresso · fina',
        'Cafetera italiana (Moka) · media',
        'V60 / filtro manual · media',
        'Cafetera eléctrica · media-fina',
        'Chemex · media-gruesa',
        'Prensa francesa · gruesa',
        'AeroPress · media-fina',
        'Cold brew · media-gruesa',
        'En grano'
      )
    )
    or (select count(distinct selected_grind.value) from unnest(p_grinds) as selected_grind(value)) <> cardinality(p_grinds) then
    raise exception 'invalid grind options';
  end if;

  select * into v_variant from public.product_variants where id = p_variant_id for update;
  if not found then return false; end if;

  v_previous := jsonb_build_object(
    'label', v_variant.label,
    'weight_grams', v_variant.weight_grams,
    'price_cop', v_variant.price_cop,
    'price_confirmed', v_variant.price_confirmed,
    'grinds', v_variant.grinds
  );
  v_next := jsonb_build_object(
    'label', trim(p_label),
    'weight_grams', p_weight_grams,
    'price_cop', p_price_cop,
    'price_confirmed', p_price_confirmed,
    'grinds', p_grinds
  );

  update public.product_variants
  set label = trim(p_label),
      weight_grams = p_weight_grams,
      price_cop = p_price_cop,
      price_confirmed = p_price_confirmed,
      grinds = p_grinds,
      updated_at = now()
  where id = p_variant_id;

  insert into public.catalog_audit_log(variant_id, action, previous_values, new_values, changed_by)
  values (p_variant_id, 'VARIANT_UPDATED', v_previous, v_next, p_admin_id);
  return true;
end $$;

revoke all on function public.admin_configure_variant(text, text, integer, integer, boolean, text[], uuid) from public, anon, authenticated;
grant execute on function public.admin_configure_variant(text, text, integer, integer, boolean, text[], uuid) to service_role;
