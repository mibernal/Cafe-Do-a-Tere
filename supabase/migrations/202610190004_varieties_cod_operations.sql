-- =====================================================================
-- 004 · Variedades de proceso, pago contra entrega, zonas de envío
--        públicas y operación completa desde el panel.
--
-- Aplica después de 001, 002 y 003. Esta migración y la versión de la
-- aplicación que la acompaña deben desplegarse juntas: reemplaza la vista
-- pública del catálogo por funciones de solo lectura y cambia la firma de
-- create_checkout_order / admin_update_order / admin_configure_*.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Utilidades
-- ---------------------------------------------------------------------

-- Moliendas comerciales permitidas. Centraliza la validación que antes se
-- repetía dentro de cada función administrativa.
create or replace function public.valid_grind_options(p_grinds text[])
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select p_grinds is not null
    and cardinality(p_grinds) between 1 and 9
    and (select count(distinct g) from unnest(p_grinds) as g) = cardinality(p_grinds)
    and not exists (
      select 1 from unnest(p_grinds) as g
      where g not in (
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
    );
$$;
revoke all on function public.valid_grind_options(text[]) from public, anon, authenticated;
grant execute on function public.valid_grind_options(text[]) to service_role;

-- Limitador genérico con ventana y máximo definidos por cada llamada. La
-- huella HMAC incluye el ámbito, así que los contadores no se mezclan.
create table if not exists public.scoped_rate_limits (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
create index if not exists scoped_rate_limits_window_idx on public.scoped_rate_limits(window_started_at);
alter table public.scoped_rate_limits enable row level security;
revoke all on public.scoped_rate_limits from public, anon, authenticated;

create or replace function public.consume_scoped_limit(p_fingerprint text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
    or p_max is null or p_max < 1 or p_max > 1000
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 604800 then
    return false;
  end if;
  insert into public.scoped_rate_limits(fingerprint) values (p_fingerprint) on conflict do nothing;
  update public.scoped_rate_limits
    set request_count = case when window_started_at < now() - make_interval(secs => p_window_seconds) then 1 else request_count + 1 end,
        window_started_at = case when window_started_at < now() - make_interval(secs => p_window_seconds) then now() else window_started_at end
    where fingerprint = p_fingerprint
    returning request_count into v_count;
  return v_count <= p_max;
end $$;

-- ---------------------------------------------------------------------
-- 2. Catálogo: nuevas variedades de proceso
-- ---------------------------------------------------------------------

alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('wood', 'precision', 'honey', 'washed', 'natural', 'gift'));

alter table public.product_variants add column if not exists bean_image_url text;

alter table public.catalog_audit_log alter column variant_id drop not null;
alter table public.catalog_audit_log add column if not exists product_id text references public.products(id) on delete cascade;
create index if not exists catalog_audit_product_idx on public.catalog_audit_log(product_id, created_at desc);

update public.product_variants
set bean_image_url = '/assets/cafe-lena-500-beans-front.jpg', updated_at = now()
where id = 'lena-500' and bean_image_url is null;

-- Las variedades nuevas se publican con precio sin confirmar y sin stock:
-- se muestran en la tienda, pero no se pueden pagar hasta que el comercio
-- confirme presentación, precio e inventario desde /admin.
insert into public.products (id, slug, category, name, subtitle, description, process, origin, altitude, notes, badge, image_url, is_published, sort_order)
values
 ('lavado', 'proceso-lavado', 'washed', 'Proceso Lavado', 'Limpio, brillante y equilibrado',
  'El método clásico de Colombia: el grano se despulpa, se fermenta y se lava antes del secado. El resultado es una taza limpia, de acidez brillante y dulzor equilibrado.',
  'Lavado', 'Finca La Libertad · Cachipay', 'Altura por confirmar',
  array['Taza limpia', 'Acidez brillante', 'Dulzor equilibrado'], 'Nuevo proceso', '/assets/beans.jpg', true, 4),
 ('natural', 'proceso-natural', 'natural', 'Proceso Natural', 'Fruta madura y cuerpo sedoso',
  'La cereza se seca entera, sin despulpar, para que la fruta entregue sus azúcares al grano. Una taza intensa y dulce, con recuerdos de fruta, chocolate y caramelo.',
  'Natural', 'Finca La Libertad · Cachipay', 'Altura por confirmar',
  array['Fruta madura', 'Chocolate', 'Caramelo'], 'Nuevo proceso', '/assets/beans-closeup.jpg', true, 5),
 ('honey-red', 'honey-red', 'honey', 'Honey Red', 'Dulzor profundo, secado pausado',
  'Conservamos buena parte del mucílago y secamos el grano con calma. Una taza dulce y redonda, con más cuerpo que el honey clásico y notas de fruta roja y panela.',
  'Honey Red', 'Finca La Libertad · Cachipay', 'Altura por confirmar',
  array['Fruta roja', 'Panela', 'Cuerpo redondo'], 'Microlote', '/assets/cafe-honey-beans-closeup.jpg', true, 6),
 ('honey-black', 'honey-black', 'honey', 'Honey Black', 'La expresión más intensa',
  'El grano se seca con todo su mucílago, lentamente y protegido del sol directo. Es el honey de mayor dulzor y cuerpo: fruta confitada, melaza y un final largo.',
  'Honey Black', 'Finca La Libertad · Cachipay', 'Altura por confirmar',
  array['Fruta confitada', 'Melaza', 'Final largo'], 'Edición limitada', '/assets/roasting.jpg', true, 7)
on conflict (id) do nothing;

insert into public.product_variants (id, product_id, label, weight_grams, price_cop, price_confirmed, stock_on_hand, grinds, image_url, bean_image_url, is_active, sort_order)
select v.id, v.product_id, v.label, v.weight_grams, 0, false, 0,
  array['Espresso · fina','Cafetera italiana (Moka) · media','V60 / filtro manual · media','Cafetera eléctrica · media-fina','Chemex · media-gruesa','Prensa francesa · gruesa','AeroPress · media-fina','Cold brew · media-gruesa','En grano'],
  v.image_url, null, true, v.sort_order
from (values
  ('lavado-250', 'lavado', '250 g', 250, '/assets/cafe-lavado-250-front.jpg', 1),
  ('lavado-500', 'lavado', '500 g', 500, '/assets/cafe-lavado-500-front.jpg', 2),
  ('natural-250', 'natural', '250 g', 250, '/assets/cafe-natural-250-front.jpg', 1),
  ('natural-500', 'natural', '500 g', 500, '/assets/cafe-natural-500-front.jpg', 2),
  ('honey-red-250', 'honey-red', '250 g', 250, '/assets/cafe-honey-red-250-front.jpg', 1),
  ('honey-red-500', 'honey-red', '500 g', 500, '/assets/cafe-honey-red-500-front.jpg', 2),
  ('honey-black-250', 'honey-black', '250 g', 250, '/assets/cafe-honey-black-250-front.jpg', 1),
  ('honey-black-500', 'honey-black', '500 g', 500, '/assets/cafe-honey-black-500-front.jpg', 2)
) as v(id, product_id, label, weight_grams, image_url, sort_order)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3. Pedidos: método de pago, contra entrega, documento y despacho
-- ---------------------------------------------------------------------

alter table public.orders
  add column if not exists payment_method text not null default 'WOMPI',
  add column if not exists customer_document_type text,
  add column if not exists customer_document_number text,
  add column if not exists courier_name text,
  add column if not exists courier_tracking_code text,
  add column if not exists cancelled_reason text,
  add column if not exists closed_by uuid references auth.users(id) on delete set null;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('WOMPI', 'CASH_ON_DELIVERY'));

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('AWAITING_PAYMENT', 'COD_PENDING', 'PAID', 'PAYMENT_REVIEW', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'));

alter table public.orders drop constraint if exists orders_document_check;
alter table public.orders add constraint orders_document_check check (
  (customer_document_type is null and customer_document_number is null)
  or (customer_document_type in ('CC', 'CE', 'NIT', 'PP', 'TI') and customer_document_number ~ '^[0-9A-Za-z-]{4,20}$')
);

alter table public.orders drop constraint if exists orders_courier_url_check;
alter table public.orders add constraint orders_courier_url_check
  check (courier_tracking_url is null or (courier_tracking_url ~ '^https://' and length(courier_tracking_url) <= 500));

create index if not exists orders_payment_status_idx on public.orders(payment_method, status, created_at desc);
create index if not exists orders_open_expiry_idx on public.orders(expires_at) where status in ('AWAITING_PAYMENT', 'COD_PENDING');

alter table public.order_events
  add column if not exists is_internal boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Zonas de envío: contra entrega por ciudad y tiempo estimado
-- ---------------------------------------------------------------------

alter table public.shipping_rates
  add column if not exists cod_enabled boolean not null default false,
  add column if not exists eta_label text not null default '';
alter table public.shipping_rates drop constraint if exists shipping_rates_eta_label_check;
alter table public.shipping_rates add constraint shipping_rates_eta_label_check check (length(eta_label) <= 60);
alter table public.shipping_rates alter column price_cop type bigint;

-- ---------------------------------------------------------------------
-- 5. Lectura pública: funciones en lugar de una vista con privilegios
--    del propietario (el linter de Supabase marca esas vistas como riesgo).
-- ---------------------------------------------------------------------

drop view if exists public.storefront_catalog;

create or replace function public.storefront_catalog_items()
returns table (
  product_id text, slug text, category text, name text, subtitle text, description text, process text,
  origin text, altitude text, notes text[], badge text, image_url text, sort_order integer,
  variant_id text, variant_label text, weight_grams integer, price_cop bigint, price_confirmed boolean,
  available_stock integer, low_stock boolean, grinds text[], variant_image_url text, bean_image_url text,
  variant_sort_order integer
)
language sql stable security definer set search_path = public, pg_temp as $$
  -- Solo expone disponibilidad gruesa (hay / quedan pocas), nunca conteos.
  select p.id, p.slug, p.category, p.name, p.subtitle, p.description, p.process, p.origin, p.altitude, p.notes, p.badge,
    p.image_url, p.sort_order, v.id, v.label, v.weight_grams, v.price_cop, v.price_confirmed,
    case when v.stock_on_hand > v.stock_reserved then 1 else 0 end,
    (v.stock_on_hand > v.stock_reserved and v.stock_on_hand - v.stock_reserved <= 5),
    v.grinds, coalesce(v.image_url, p.image_url), v.bean_image_url, v.sort_order
  from public.products p
  join public.product_variants v on v.product_id = p.id
  where p.is_published and v.is_active
  order by p.sort_order, p.id, v.sort_order, v.id;
$$;

create or replace function public.storefront_shipping_zones()
returns table (city_key text, city_label text, price_cop bigint, cod_enabled boolean, eta_label text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.city_key, s.city_label, s.price_cop, s.cod_enabled, s.eta_label
  from public.shipping_rates s
  where s.is_active
  order by s.city_label;
$$;

revoke all on function public.storefront_catalog_items() from public, anon, authenticated;
revoke all on function public.storefront_shipping_zones() from public, anon, authenticated;
grant execute on function public.storefront_catalog_items() to anon, authenticated, service_role;
grant execute on function public.storefront_shipping_zones() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Métricas del panel
-- ---------------------------------------------------------------------

drop view if exists public.admin_store_metrics;
create view public.admin_store_metrics with (security_invoker = true) as
select
  coalesce(sum(total_cop) filter (where paid_at is not null and status not in ('REFUNDED', 'CANCELLED')), 0)::bigint as paid_revenue_cop,
  coalesce(sum(total_cop) filter (where paid_at is not null and status not in ('REFUNDED', 'CANCELLED') and paid_at >= now() - interval '7 days'), 0)::bigint as revenue_7d_cop,
  count(*) filter (where paid_at is not null and status not in ('REFUNDED', 'CANCELLED'))::bigint as paid_orders,
  count(*) filter (where status = 'AWAITING_PAYMENT')::bigint as pending_orders,
  count(*) filter (where status = 'COD_PENDING')::bigint as cod_pending_orders,
  count(*) filter (where status in ('PAID', 'PREPARING'))::bigint as to_fulfill_orders,
  coalesce(sum(total_cop) filter (where payment_method = 'CASH_ON_DELIVERY' and paid_at is null and status in ('PREPARING', 'SHIPPED')), 0)::bigint as cod_receivable_cop,
  count(*)::bigint as total_orders,
  (select count(*) from public.product_variants v join public.products p on p.id = v.product_id
    where v.is_active and p.is_published and v.price_confirmed and v.stock_on_hand - v.stock_reserved <= 5)::bigint as low_stock_variants,
  count(*) filter (where payment_review_reason is not null)::bigint as payment_review_orders
from public.orders;
revoke all on public.admin_store_metrics from public, anon, authenticated;
grant select on public.admin_store_metrics to service_role;

-- ---------------------------------------------------------------------
-- 7. Checkout: Wompi o contra entrega
-- ---------------------------------------------------------------------

drop function if exists public.create_checkout_order(text, text, jsonb, jsonb, text);

create or replace function public.create_checkout_order(
  p_reference text, p_city_key text, p_customer jsonb, p_items jsonb, p_tracking_token_hash text,
  p_payment_method text, p_cod_max_cop bigint
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_rate public.shipping_rates%rowtype;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_quantity integer;
  v_units integer := 0;
  v_grind text;
  v_subtotal bigint := 0;
  v_policy_version text;
  v_doc_type text;
  v_doc_number text;
  v_is_cod boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_reference is null or p_reference !~ '^CDT-[A-Z0-9-]{8,60}$'
    or p_city_key is null or p_city_key !~ '^[a-z0-9-]{2,80}$'
    or p_tracking_token_hash is null or p_tracking_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid checkout';
  end if;
  if p_payment_method is null or p_payment_method not in ('WOMPI', 'CASH_ON_DELIVERY') then raise exception 'invalid payment method'; end if;
  v_is_cod := p_payment_method = 'CASH_ON_DELIVERY';

  if coalesce(p_customer->>'privacyConsent', 'false') <> 'true' then raise exception 'privacy consent required'; end if;
  v_policy_version := p_customer->>'privacyPolicyVersion';
  if v_policy_version is null or length(trim(v_policy_version)) < 1 or length(v_policy_version) > 80 or lower(v_policy_version) like '%draft%' then
    raise exception 'privacy policy is not ready';
  end if;
  if length(coalesce(trim(p_customer->>'name'), '')) not between 2 and 100
    or length(coalesce(p_customer->>'email', '')) not between 3 and 254
    or coalesce(p_customer->>'phone', '') !~ '^3[0-9]{9}$'
    or length(coalesce(trim(p_customer->>'address'), '')) not between 5 and 180
    or length(coalesce(p_customer->>'notes', '')) > 300 then
    raise exception 'invalid customer';
  end if;
  v_doc_type := nullif(trim(coalesce(p_customer->>'documentType', '')), '');
  v_doc_number := nullif(trim(coalesce(p_customer->>'documentNumber', '')), '');
  if (v_doc_type is null) <> (v_doc_number is null) then raise exception 'invalid document'; end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then
    raise exception 'invalid items';
  end if;
  perform public.expire_checkout_orders();

  select * into v_rate from public.shipping_rates where city_key = p_city_key and is_active;
  if not found then raise exception 'shipping rate unavailable'; end if;
  if v_is_cod and not v_rate.cod_enabled then raise exception 'cash on delivery unavailable'; end if;

  insert into public.orders(
    reference, status, payment_method, customer_name, customer_email, customer_phone,
    customer_document_type, customer_document_number, city, address, delivery_notes,
    shipping_cop, total_cop, tracking_token_hash, privacy_consent_at, privacy_policy_version, expires_at
  ) values (
    p_reference, case when v_is_cod then 'COD_PENDING' else 'AWAITING_PAYMENT' end, p_payment_method,
    trim(p_customer->>'name'), lower(trim(p_customer->>'email')), p_customer->>'phone',
    v_doc_type, v_doc_number, v_rate.city_label, trim(p_customer->>'address'), coalesce(trim(p_customer->>'notes'), ''),
    v_rate.price_cop, v_rate.price_cop, p_tracking_token_hash, now(), v_policy_version,
    case when v_is_cod then now() + interval '72 hours' else now() + interval '35 minutes' end
  ) returning * into v_order;

  for v_item in
    select entry.value from jsonb_array_elements(p_items) as entry(value)
    order by entry.value->>'variantId', entry.value->>'grind'
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_grind := v_item->>'grind';
    if v_quantity is null or v_quantity < 1 or v_quantity > 10 then raise exception 'invalid quantity'; end if;
    v_units := v_units + v_quantity;
    if v_units > 30 then raise exception 'too many units'; end if;

    select * into v_variant from public.product_variants where id = v_item->>'variantId' and is_active for update;
    if not found or not v_variant.price_confirmed or v_variant.price_cop <= 0 then raise exception 'variant not ready'; end if;
    if v_grind is null or not (v_variant.grinds @> array[v_grind]) then raise exception 'grind unavailable'; end if;
    select * into v_product from public.products where id = v_variant.product_id and is_published;
    if not found then raise exception 'product unavailable'; end if;
    if v_variant.stock_on_hand - v_variant.stock_reserved < v_quantity then raise exception 'insufficient stock'; end if;

    update public.product_variants set stock_reserved = stock_reserved + v_quantity, updated_at = now() where id = v_variant.id;
    insert into public.order_items(order_id, variant_id, product_name, variant_label, grind, quantity, unit_price_cop, line_total_cop)
    values (v_order.id, v_variant.id, v_product.name, v_variant.label, v_grind, v_quantity, v_variant.price_cop, v_variant.price_cop * v_quantity);
    insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note)
    values (v_variant.id, v_order.id, 'RESERVE', v_quantity,
      case when v_is_cod then 'Reserva de pedido contra entrega por confirmar' else 'Reserva durante el plazo del checkout Wompi' end);
    v_subtotal := v_subtotal + v_variant.price_cop * v_quantity;
  end loop;

  if v_is_cod and (p_cod_max_cop is null or p_cod_max_cop <= 0 or v_subtotal + v_rate.price_cop > p_cod_max_cop) then
    raise exception 'cash on delivery limit exceeded';
  end if;

  update public.orders set subtotal_cop = v_subtotal, total_cop = v_subtotal + v_rate.price_cop, updated_at = now()
  where id = v_order.id returning * into v_order;
  insert into public.order_events(order_id, status, message) values (v_order.id, v_order.status,
    case when v_is_cod
      then 'Recibimos tu pedido contra entrega. Te contactaremos para confirmarlo antes del despacho.'
      else 'Pedido recibido y unidades reservadas mientras completas el pago.' end);

  return jsonb_build_object(
    'id', v_order.id, 'reference', v_order.reference, 'status', v_order.status,
    'subtotal_cop', v_order.subtotal_cop, 'shipping_cop', v_order.shipping_cop, 'total_cop', v_order.total_cop,
    'city_label', v_order.city, 'expires_at', v_order.expires_at
  );
end $$;

-- Libera las reservas de un pedido abierto. Uso interno de otras funciones.
create or replace function public.release_order_reservations(p_order_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_item record;
begin
  if auth.role() is not null and auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  for v_item in
    select variant_id, sum(quantity)::integer as quantity
    from public.order_items where order_id = p_order_id group by variant_id order by variant_id
  loop
    update public.product_variants set stock_reserved = greatest(stock_reserved - v_item.quantity, 0), updated_at = now() where id = v_item.variant_id;
    insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note)
    values (v_item.variant_id, p_order_id, 'RELEASE', v_item.quantity, left(p_note, 200));
  end loop;
end $$;

create or replace function public.cancel_checkout_order(p_reference text, p_reason text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  select * into v_order from public.orders where reference = p_reference for update;
  if not found or v_order.status not in ('AWAITING_PAYMENT', 'COD_PENDING') then return false; end if;
  perform public.release_order_reservations(v_order.id, 'Reserva liberada al preparar el pago');
  update public.orders set status = 'CANCELLED', cancelled_reason = left(coalesce(p_reason, 'No fue posible preparar el pago.'), 200), updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, status, message) values (v_order.id, 'CANCELLED', left(coalesce(p_reason, 'No fue posible preparar el pago.'), 200));
  return true;
end $$;

-- El cliente puede soltar su reserva (editar la bolsa o cancelar un pedido
-- contra entrega) con el token de seguimiento que solo él conoce.
create or replace function public.cancel_checkout_by_token(p_token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  select * into v_order from public.orders where tracking_token_hash = p_token_hash for update;
  if not found or v_order.status not in ('AWAITING_PAYMENT', 'COD_PENDING') then return false; end if;
  perform public.release_order_reservations(v_order.id, 'Reserva liberada por solicitud del cliente');
  update public.orders set status = 'CANCELLED', cancelled_reason = 'Cancelado por el cliente antes del pago o la confirmación.', updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, status, message) values (v_order.id, 'CANCELLED', 'Cancelaste el pedido y liberamos las unidades reservadas.');
  return true;
end $$;

create or replace function public.expire_checkout_orders()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_expired integer := 0;
begin
  -- Solo llamadas con la llave de servicio o tareas internas de la base.
  if auth.role() is not null and auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  for v_order in
    select * from public.orders
    where status in ('AWAITING_PAYMENT', 'COD_PENDING') and expires_at < now()
    order by expires_at
    for update skip locked
  loop
    perform public.release_order_reservations(v_order.id, 'Reserva vencida');
    update public.orders set status = 'CANCELLED',
      cancelled_reason = case when v_order.status = 'COD_PENDING' then 'Pedido contra entrega sin confirmar dentro del plazo.' else 'La reserva venció antes de completar el pago.' end,
      updated_at = now()
    where id = v_order.id;
    insert into public.order_events(order_id, status, message) values (v_order.id, 'CANCELLED',
      case when v_order.status = 'COD_PENDING'
        then 'El pedido no se confirmó a tiempo y liberamos las unidades. Escríbenos si aún lo quieres.'
        else 'La reserva venció antes de completar el pago.' end);
    v_expired := v_expired + 1;
  end loop;
  return v_expired;
end $$;

-- ---------------------------------------------------------------------
-- 8. Conciliación Wompi (solo pedidos WOMPI, bloqueos en orden estable)
-- ---------------------------------------------------------------------

create or replace function public.settle_wompi_transaction(
  p_event_key text, p_reference text, p_transaction_id text, p_status text, p_amount_in_cents bigint, p_currency text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_variant public.product_variants%rowtype;
  v_has_stock boolean := true;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_event_key is null or p_event_key !~ '^[a-f0-9]{64}$' or p_reference is null or length(p_reference) > 80
    or p_transaction_id is null or length(p_transaction_id) > 120 then return false; end if;
  if p_status is null or p_status not in ('APPROVED', 'DECLINED', 'ERROR', 'VOIDED') then return false; end if;

  select * into v_order from public.orders where reference = p_reference for update;
  if not found or v_order.payment_method <> 'WOMPI' or p_currency is distinct from 'COP'
    or p_amount_in_cents is null or p_amount_in_cents <> v_order.total_cop::bigint * 100 then
    return false;
  end if;

  insert into public.wompi_webhook_events(event_key, reference, transaction_id, transaction_status)
  values (p_event_key, p_reference, p_transaction_id, p_status) on conflict do nothing;
  if not found then return true; end if;

  if v_order.status = 'AWAITING_PAYMENT' then
    if p_status = 'APPROVED' then
      update public.orders set status = 'PAID', wompi_transaction_id = p_transaction_id, paid_at = now(), updated_at = now() where id = v_order.id;
      for v_item in
        select variant_id, sum(quantity)::integer as quantity
        from public.order_items where order_id = v_order.id group by variant_id order by variant_id
      loop
        update public.product_variants
          set stock_on_hand = stock_on_hand - v_item.quantity, stock_reserved = stock_reserved - v_item.quantity, updated_at = now()
          where id = v_item.variant_id;
        insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note)
        values (v_item.variant_id, v_order.id, 'SALE', v_item.quantity, 'Venta pagada por Wompi');
      end loop;
      insert into public.order_events(order_id, status, message) values (v_order.id, 'PAID', 'Pago confirmado por Wompi.');
    else
      perform public.release_order_reservations(v_order.id, 'Reserva liberada tras pago no aprobado');
      update public.orders set status = 'CANCELLED', cancelled_reason = 'Pago no aprobado (' || p_status || ').', updated_at = now() where id = v_order.id;
      insert into public.order_events(order_id, status, message) values (v_order.id, 'CANCELLED', 'El pago no fue aprobado y liberamos la reserva. Puedes intentarlo de nuevo desde la tienda.');
    end if;
    return true;
  end if;

  if p_status = 'APPROVED' and v_order.status = 'CANCELLED' and v_order.paid_at is null then
    -- Una aprobación tardía pero válida no puede perderse tras vencer la reserva.
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      select * into v_variant from public.product_variants where id = v_item.variant_id for update;
      if not found or v_variant.stock_on_hand - v_variant.stock_reserved < v_item.quantity then v_has_stock := false; end if;
    end loop;

    if v_has_stock then
      for v_item in
        select variant_id, sum(quantity)::integer as quantity
        from public.order_items where order_id = v_order.id group by variant_id order by variant_id
      loop
        update public.product_variants set stock_on_hand = stock_on_hand - v_item.quantity, updated_at = now() where id = v_item.variant_id;
        insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note)
        values (v_item.variant_id, v_order.id, 'SALE', v_item.quantity, 'Pago aprobado después de vencer la reserva; inventario validado');
      end loop;
      update public.orders set status = 'PAID', wompi_transaction_id = p_transaction_id, paid_at = now(), cancelled_reason = null, updated_at = now() where id = v_order.id;
      insert into public.order_events(order_id, status, message) values (v_order.id, 'PAID', 'Pago confirmado; verificamos la disponibilidad después de recibir la notificación.');
    else
      update public.orders set status = 'PAYMENT_REVIEW', wompi_transaction_id = p_transaction_id, paid_at = now(), cancelled_reason = null,
        payment_review_reason = 'Pago aprobado después de vencer la reserva; revisar inventario y contactar al cliente.', updated_at = now()
      where id = v_order.id;
      insert into public.order_events(order_id, status, message) values (v_order.id, 'PAYMENT_REVIEW', 'El pago fue aprobado y estamos confirmando la disponibilidad de inventario.');
    end if;
    return true;
  end if;

  if p_status = 'APPROVED' and v_order.wompi_transaction_id is not null and v_order.wompi_transaction_id <> p_transaction_id then
    update public.orders set payment_review_reason = 'Se recibió más de un pago aprobado para esta referencia; verificar y gestionar el pago duplicado.', updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id, status, message, is_internal)
    values (v_order.id, v_order.status, 'Pago aprobado adicional ' || p_transaction_id || ' para la misma referencia.', true);
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 9. Operación del pedido desde el panel
-- ---------------------------------------------------------------------

drop function if exists public.admin_update_order(uuid, text, text);

create or replace function public.admin_update_order(
  p_order_id uuid, p_status text, p_tracking_url text, p_courier_name text, p_tracking_code text, p_admin_id uuid
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_variant public.product_variants%rowtype;
  v_has_stock boolean := true;
  v_message text;
  v_url text := nullif(trim(coalesce(p_tracking_url, '')), '');
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_status not in ('PREPARING', 'SHIPPED', 'DELIVERED') then raise exception 'invalid status'; end if;
  if v_url is not null and (v_url !~ '^https://' or length(v_url) > 500) then raise exception 'invalid tracking url'; end if;
  if length(coalesce(p_courier_name, '')) > 80 or length(coalesce(p_tracking_code, '')) > 80 then raise exception 'invalid courier'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;

  if p_status = 'PREPARING' and v_order.status = 'PAYMENT_REVIEW' then
    -- Concilia el inventario antes de comprometer un pedido pagado.
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      select * into v_variant from public.product_variants where id = v_item.variant_id for update;
      if not found or v_variant.stock_on_hand - v_variant.stock_reserved < v_item.quantity then v_has_stock := false; end if;
    end loop;
    if not v_has_stock then return false; end if;
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      update public.product_variants set stock_on_hand = stock_on_hand - v_item.quantity, updated_at = now() where id = v_item.variant_id;
      insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note, created_by)
      values (v_item.variant_id, v_order.id, 'SALE', v_item.quantity, 'Pago conciliado; inventario validado para preparación', p_admin_id);
    end loop;
    v_message := 'La disponibilidad fue validada y tu pedido pasa a preparación.';
  elsif p_status = 'PREPARING' and v_order.status = 'COD_PENDING' then
    -- El pedido contra entrega confirmado convierte su reserva en venta.
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      update public.product_variants
        set stock_on_hand = stock_on_hand - v_item.quantity, stock_reserved = stock_reserved - v_item.quantity, updated_at = now()
        where id = v_item.variant_id;
      insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note, created_by)
      values (v_item.variant_id, v_order.id, 'SALE', v_item.quantity, 'Pedido contra entrega confirmado con el cliente', p_admin_id);
    end loop;
    v_message := 'Confirmamos tu pedido contra entrega y ya lo estamos preparando.';
  elsif p_status = 'PREPARING' and v_order.status = 'PAID' then
    v_message := 'Tu pedido está en preparación.';
  elsif p_status = 'SHIPPED' and v_order.status = 'PREPARING' then
    v_message := 'Tu pedido salió a despacho.';
  elsif p_status = 'DELIVERED' and v_order.status = 'SHIPPED' then
    v_message := case when v_order.payment_method = 'CASH_ON_DELIVERY'
      then 'Tu pedido fue entregado y recibimos el pago contra entrega. ¡Gracias!'
      else 'Tu pedido fue entregado. ¡Que lo disfrutes!' end;
  else
    return false;
  end if;

  update public.orders set
    status = p_status,
    courier_tracking_url = case when p_status = 'SHIPPED' then v_url else courier_tracking_url end,
    courier_name = case when p_status = 'SHIPPED' then nullif(trim(coalesce(p_courier_name, '')), '') else courier_name end,
    courier_tracking_code = case when p_status = 'SHIPPED' then nullif(trim(coalesce(p_tracking_code, '')), '') else courier_tracking_code end,
    paid_at = case when p_status = 'DELIVERED' and v_order.payment_method = 'CASH_ON_DELIVERY' and paid_at is null then now() else paid_at end,
    payment_review_reason = case when v_order.status = 'PAYMENT_REVIEW' then null else payment_review_reason end,
    updated_at = now()
  where id = p_order_id;
  insert into public.order_events(order_id, status, message, created_by) values (p_order_id, p_status, v_message, p_admin_id);
  return true;
end $$;

-- Cancela un pedido no pagado o registra un reembolso hecho en Wompi.
create or replace function public.admin_close_order(
  p_order_id uuid, p_action text, p_restock boolean, p_reason text, p_admin_id uuid
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_reason text := left(nullif(trim(coalesce(p_reason, '')), ''), 200);
  v_stock_was_sold boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_action not in ('CANCEL', 'REFUND') or v_reason is null or length(v_reason) < 3 then raise exception 'invalid close request'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;

  if p_action = 'CANCEL' then
    if v_order.paid_at is not null then return false; end if;
    if v_order.status in ('AWAITING_PAYMENT', 'COD_PENDING') then
      perform public.release_order_reservations(v_order.id, 'Pedido cancelado desde el panel');
    elsif v_order.status in ('PREPARING', 'SHIPPED') and v_order.payment_method = 'CASH_ON_DELIVERY' then
      if coalesce(p_restock, false) then
        for v_item in
          select variant_id, sum(quantity)::integer as quantity
          from public.order_items where order_id = v_order.id group by variant_id order by variant_id
        loop
          update public.product_variants set stock_on_hand = stock_on_hand + v_item.quantity, updated_at = now() where id = v_item.variant_id;
          insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note, created_by)
          values (v_item.variant_id, v_order.id, 'RESTOCK', v_item.quantity, 'Pedido contra entrega cancelado; unidades devueltas', p_admin_id);
        end loop;
      end if;
    else
      return false;
    end if;
    update public.orders set status = 'CANCELLED', cancelled_reason = v_reason, closed_by = p_admin_id, updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id, status, message, created_by) values (v_order.id, 'CANCELLED', 'La tienda canceló el pedido. Escríbenos si tienes preguntas.', p_admin_id);
    insert into public.order_events(order_id, status, message, is_internal, created_by) values (v_order.id, 'CANCELLED', 'Motivo: ' || v_reason, true, p_admin_id);
    return true;
  end if;

  -- REFUND: el reembolso se ejecuta en el dashboard de Wompi; aquí se registra.
  if v_order.paid_at is null or v_order.status not in ('PAID', 'PAYMENT_REVIEW', 'PREPARING', 'SHIPPED', 'DELIVERED') then return false; end if;
  v_stock_was_sold := v_order.status <> 'PAYMENT_REVIEW';
  if coalesce(p_restock, false) and v_stock_was_sold then
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      update public.product_variants set stock_on_hand = stock_on_hand + v_item.quantity, updated_at = now() where id = v_item.variant_id;
      insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note, created_by)
      values (v_item.variant_id, v_order.id, 'RESTOCK', v_item.quantity, 'Reembolso; unidades devueltas al inventario', p_admin_id);
    end loop;
  end if;
  update public.orders set status = 'REFUNDED', payment_review_reason = null, cancelled_reason = v_reason, closed_by = p_admin_id, updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, status, message, created_by) values (v_order.id, 'REFUNDED', 'Registramos la devolución de tu pago.', p_admin_id);
  insert into public.order_events(order_id, status, message, is_internal, created_by) values (v_order.id, 'REFUNDED', 'Motivo: ' || v_reason, true, p_admin_id);
  return true;
end $$;

create or replace function public.admin_resolve_payment_review(p_order_id uuid, p_note text, p_admin_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_note text := left(nullif(trim(coalesce(p_note, '')), ''), 200);
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if v_note is null or length(v_note) < 3 then raise exception 'note required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  -- PAYMENT_REVIEW se resuelve preparando (con stock) o reembolsando.
  if not found or v_order.payment_review_reason is null or v_order.status = 'PAYMENT_REVIEW' then return false; end if;
  update public.orders set payment_review_reason = null, updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, status, message, is_internal, created_by) values (v_order.id, v_order.status, 'Novedad de pago resuelta: ' || v_note, true, p_admin_id);
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 10. Catálogo y envíos desde el panel
-- ---------------------------------------------------------------------

create or replace function public.admin_configure_product(
  p_product_id text, p_name text, p_subtitle text, p_description text, p_notes text[], p_badge text,
  p_published boolean, p_sort_order integer, p_admin_id uuid
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_product public.products%rowtype; v_previous jsonb; v_next jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 80
    or length(coalesce(p_subtitle, '')) > 120
    or length(coalesce(p_description, '')) > 600
    or length(coalesce(p_badge, '')) > 40
    or p_notes is null or cardinality(p_notes) > 5
    or exists (select 1 from unnest(p_notes) n where length(trim(n)) not between 1 and 40)
    or p_published is null or p_sort_order is null or p_sort_order not between 0 and 1000 then
    raise exception 'invalid product values';
  end if;
  select * into v_product from public.products where id = p_product_id for update;
  if not found then return false; end if;
  v_previous := jsonb_build_object('name', v_product.name, 'subtitle', v_product.subtitle, 'description', v_product.description,
    'notes', v_product.notes, 'badge', v_product.badge, 'is_published', v_product.is_published, 'sort_order', v_product.sort_order);
  v_next := jsonb_build_object('name', trim(p_name), 'subtitle', trim(coalesce(p_subtitle, '')), 'description', trim(coalesce(p_description, '')),
    'notes', p_notes, 'badge', trim(coalesce(p_badge, '')), 'is_published', p_published, 'sort_order', p_sort_order);
  update public.products set name = trim(p_name), subtitle = trim(coalesce(p_subtitle, '')), description = trim(coalesce(p_description, '')),
    notes = (select coalesce(array_agg(trim(n)), '{}') from unnest(p_notes) n), badge = trim(coalesce(p_badge, '')),
    is_published = p_published, sort_order = p_sort_order, updated_at = now()
  where id = p_product_id;
  insert into public.catalog_audit_log(variant_id, product_id, action, previous_values, new_values, changed_by)
  values (null, p_product_id, 'PRODUCT_UPDATED', v_previous, v_next, p_admin_id);
  return true;
end $$;

drop function if exists public.admin_configure_variant(text, text, integer, integer, boolean, text[], uuid);
drop function if exists public.admin_configure_variant(text, text, integer, integer, boolean, uuid);

create or replace function public.admin_configure_variant(
  p_variant_id text, p_label text, p_weight_grams integer, p_price_cop bigint, p_price_confirmed boolean,
  p_grinds text[], p_active boolean, p_admin_id uuid
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_variant public.product_variants%rowtype; v_previous jsonb; v_next jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if length(trim(coalesce(p_label, ''))) not between 2 and 60
    or p_weight_grams is null or p_weight_grams not between 50 and 20000
    or p_price_cop is null or p_price_cop not between 0 and 100000000
    or p_price_confirmed is null or p_active is null then
    raise exception 'invalid variant values';
  end if;
  if p_price_confirmed and p_price_cop = 0 then raise exception 'confirmed price must be positive'; end if;
  if not public.valid_grind_options(p_grinds) then raise exception 'invalid grind options'; end if;

  select * into v_variant from public.product_variants where id = p_variant_id for update;
  if not found then return false; end if;
  v_previous := jsonb_build_object('label', v_variant.label, 'weight_grams', v_variant.weight_grams, 'price_cop', v_variant.price_cop,
    'price_confirmed', v_variant.price_confirmed, 'grinds', v_variant.grinds, 'is_active', v_variant.is_active);
  v_next := jsonb_build_object('label', trim(p_label), 'weight_grams', p_weight_grams, 'price_cop', p_price_cop,
    'price_confirmed', p_price_confirmed, 'grinds', p_grinds, 'is_active', p_active);
  update public.product_variants set label = trim(p_label), weight_grams = p_weight_grams, price_cop = p_price_cop,
    price_confirmed = p_price_confirmed, grinds = p_grinds, is_active = p_active, updated_at = now()
  where id = p_variant_id;
  insert into public.catalog_audit_log(variant_id, product_id, action, previous_values, new_values, changed_by)
  values (p_variant_id, v_variant.product_id, 'VARIANT_UPDATED', v_previous, v_next, p_admin_id);
  return true;
end $$;

create or replace function public.admin_create_variant(
  p_product_id text, p_label text, p_weight_grams integer, p_price_cop bigint, p_grinds text[], p_admin_id uuid
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id text; v_image text; v_sort integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if length(trim(coalesce(p_label, ''))) not between 2 and 60
    or p_weight_grams is null or p_weight_grams not between 50 and 20000
    or p_price_cop is null or p_price_cop not between 0 and 100000000 then
    raise exception 'invalid variant values';
  end if;
  if not public.valid_grind_options(p_grinds) then raise exception 'invalid grind options'; end if;
  perform 1 from public.products where id = p_product_id for update;
  if not found then return null; end if;
  if (select count(*) from public.product_variants where product_id = p_product_id) >= 12 then raise exception 'too many variants'; end if;

  v_id := left(p_product_id, 60) || '-' || p_weight_grams || 'g';
  if exists (select 1 from public.product_variants where id = v_id) then
    v_id := v_id || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;
  -- La foto del producto evita mostrar una etiqueta con otro peso neto.
  select image_url into v_image from public.products where id = p_product_id;
  select coalesce(max(sort_order), 0) + 1 into v_sort from public.product_variants where product_id = p_product_id;

  insert into public.product_variants(id, product_id, label, weight_grams, price_cop, price_confirmed, stock_on_hand, grinds, image_url, is_active, sort_order)
  values (v_id, p_product_id, trim(p_label), p_weight_grams, p_price_cop, false, 0, p_grinds, v_image, true, v_sort);
  insert into public.catalog_audit_log(variant_id, product_id, action, previous_values, new_values, changed_by)
  values (v_id, p_product_id, 'VARIANT_CREATED', '{}'::jsonb,
    jsonb_build_object('label', trim(p_label), 'weight_grams', p_weight_grams, 'price_cop', p_price_cop, 'grinds', p_grinds), p_admin_id);
  return v_id;
end $$;

drop function if exists public.admin_configure_shipping_rate(text, text, integer, boolean, uuid);

create or replace function public.admin_configure_shipping_rate(
  p_city_key text, p_city_label text, p_price_cop bigint, p_active boolean, p_cod_enabled boolean, p_eta_label text, p_admin_id uuid
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_previous jsonb; v_next jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_city_key is null or p_city_key !~ '^[a-z0-9-]{2,80}$'
    or length(trim(coalesce(p_city_label, ''))) not between 2 and 80
    or p_price_cop is null or p_price_cop not between 0 and 100000000
    or p_active is null or p_cod_enabled is null
    or length(coalesce(p_eta_label, '')) > 60 then
    raise exception 'invalid shipping rate';
  end if;
  select jsonb_build_object('city_label', city_label, 'price_cop', price_cop, 'is_active', is_active, 'cod_enabled', cod_enabled, 'eta_label', eta_label)
    into v_previous from public.shipping_rates where city_key = p_city_key for update;
  v_previous := coalesce(v_previous, '{}'::jsonb);
  v_next := jsonb_build_object('city_label', trim(p_city_label), 'price_cop', p_price_cop, 'is_active', p_active,
    'cod_enabled', p_cod_enabled, 'eta_label', trim(coalesce(p_eta_label, '')));
  insert into public.shipping_rates(city_key, city_label, price_cop, is_active, cod_enabled, eta_label, updated_at)
  values (p_city_key, trim(p_city_label), p_price_cop, p_active, p_cod_enabled, trim(coalesce(p_eta_label, '')), now())
  on conflict (city_key) do update set city_label = excluded.city_label, price_cop = excluded.price_cop, is_active = excluded.is_active,
    cod_enabled = excluded.cod_enabled, eta_label = excluded.eta_label, updated_at = now();
  insert into public.shipping_rate_audit_log(city_key, action, previous_values, new_values, changed_by)
  values (p_city_key, 'RATE_UPDATED', v_previous, v_next, p_admin_id);
  return true;
end $$;

-- Consistencia: comparación nula segura en funciones previas que seguían
-- usando "auth.role() <> 'service_role'".
create or replace function public.admin_adjust_inventory(p_variant_id text, p_delta integer, p_note text, p_admin_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_variant public.product_variants%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 or length(trim(coalesce(p_note, ''))) not between 2 and 200 then
    raise exception 'invalid adjustment';
  end if;
  select * into v_variant from public.product_variants where id = p_variant_id for update;
  if not found or v_variant.stock_on_hand + p_delta < v_variant.stock_reserved then return false; end if;
  update public.product_variants set stock_on_hand = stock_on_hand + p_delta, updated_at = now() where id = p_variant_id;
  insert into public.inventory_movements(variant_id, movement_type, quantity, note, created_by)
  values (p_variant_id, case when p_delta > 0 then 'RESTOCK' else 'ADJUSTMENT' end, abs(p_delta), left(trim(p_note), 200), p_admin_id);
  return true;
end $$;

create or replace function public.consume_checkout_limit(p_fingerprint text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into public.checkout_rate_limits(fingerprint) values (p_fingerprint) on conflict do nothing;
  update public.checkout_rate_limits
    set request_count = case when window_started_at < now() - interval '1 hour' then 1 else request_count + 1 end,
        window_started_at = case when window_started_at < now() - interval '1 hour' then now() else window_started_at end
    where fingerprint = p_fingerprint returning request_count into v_count;
  return v_count <= 8;
end $$;

create or replace function public.prune_store_rate_limits()
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_deleted bigint := 0; v_rows bigint := 0;
begin
  if auth.role() is not null and auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  delete from public.checkout_rate_limits where window_started_at < now() - interval '24 hours';
  get diagnostics v_rows = row_count; v_deleted := v_deleted + v_rows;
  delete from public.admin_login_rate_limits where window_started_at < now() - interval '24 hours';
  get diagnostics v_rows = row_count; v_deleted := v_deleted + v_rows;
  delete from public.scoped_rate_limits where window_started_at < now() - interval '8 days';
  get diagnostics v_rows = row_count; v_deleted := v_deleted + v_rows;
  return v_deleted;
end $$;

-- ---------------------------------------------------------------------
-- 11. Permisos: solo la llave de servicio ejecuta funciones operativas
-- ---------------------------------------------------------------------

revoke all on function public.consume_scoped_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_checkout_order(text, text, jsonb, jsonb, text, text, bigint) from public, anon, authenticated;
revoke all on function public.release_order_reservations(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_checkout_order(text, text) from public, anon, authenticated;
revoke all on function public.cancel_checkout_by_token(text) from public, anon, authenticated;
revoke all on function public.expire_checkout_orders() from public, anon, authenticated;
revoke all on function public.settle_wompi_transaction(text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.admin_update_order(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_close_order(uuid, text, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_resolve_payment_review(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_configure_product(text, text, text, text, text[], text, boolean, integer, uuid) from public, anon, authenticated;
revoke all on function public.admin_configure_variant(text, text, integer, bigint, boolean, text[], boolean, uuid) from public, anon, authenticated;
revoke all on function public.admin_create_variant(text, text, integer, bigint, text[], uuid) from public, anon, authenticated;
revoke all on function public.admin_configure_shipping_rate(text, text, bigint, boolean, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_adjust_inventory(text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.consume_checkout_limit(text) from public, anon, authenticated;
revoke all on function public.prune_store_rate_limits() from public, anon, authenticated;

grant execute on function public.consume_scoped_limit(text, integer, integer) to service_role;
grant execute on function public.create_checkout_order(text, text, jsonb, jsonb, text, text, bigint) to service_role;
grant execute on function public.release_order_reservations(uuid, text) to service_role;
grant execute on function public.cancel_checkout_order(text, text) to service_role;
grant execute on function public.cancel_checkout_by_token(text) to service_role;
grant execute on function public.expire_checkout_orders() to service_role;
grant execute on function public.settle_wompi_transaction(text, text, text, text, bigint, text) to service_role;
grant execute on function public.admin_update_order(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.admin_close_order(uuid, text, boolean, text, uuid) to service_role;
grant execute on function public.admin_resolve_payment_review(uuid, text, uuid) to service_role;
grant execute on function public.admin_configure_product(text, text, text, text, text[], text, boolean, integer, uuid) to service_role;
grant execute on function public.admin_configure_variant(text, text, integer, bigint, boolean, text[], boolean, uuid) to service_role;
grant execute on function public.admin_create_variant(text, text, integer, bigint, text[], uuid) to service_role;
grant execute on function public.admin_configure_shipping_rate(text, text, bigint, boolean, boolean, text, uuid) to service_role;
grant execute on function public.admin_adjust_inventory(text, integer, text, uuid) to service_role;
grant execute on function public.consume_checkout_limit(text) to service_role;
grant execute on function public.prune_store_rate_limits() to service_role;

-- Las tablas privadas no se consultan desde el navegador. Supabase concede
-- privilegios por defecto a anon/authenticated; RLS los bloquea, pero se
-- retiran explícitamente para reducir la superficie.
revoke all on public.orders, public.order_items, public.order_events, public.inventory_movements,
  public.catalog_audit_log, public.shipping_rates, public.shipping_rate_audit_log, public.wompi_webhook_events,
  public.checkout_rate_limits from anon;
