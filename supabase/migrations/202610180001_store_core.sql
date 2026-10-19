create extension if not exists pgcrypto with schema extensions;

create table if not exists public.products (
  id text primary key,
  slug text not null unique,
  category text not null check (category in ('wood', 'precision', 'honey', 'gift')),
  name text not null,
  subtitle text not null default '',
  description text not null default '',
  process text not null default '',
  origin text not null default 'Finca La Libertad · Cachipay',
  altitude text not null default 'Por confirmar',
  notes text[] not null default '{}',
  badge text not null default '',
  image_url text not null,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  label text not null,
  weight_grams integer not null check (weight_grams > 0),
  price_cop integer not null default 0 check (price_cop >= 0),
  price_confirmed boolean not null default false,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0 and stock_reserved <= stock_on_hand),
  grinds text[] not null default '{Molido}',
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'AWAITING_PAYMENT' check (status in ('AWAITING_PAYMENT', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  city text not null,
  address text not null,
  delivery_notes text not null default '',
  subtotal_cop integer not null default 0 check (subtotal_cop >= 0),
  shipping_cop integer not null default 0 check (shipping_cop >= 0),
  total_cop integer not null default 0 check (total_cop >= 0),
  tracking_token_hash text not null unique,
  wompi_transaction_id text unique,
  courier_tracking_url text,
  expires_at timestamptz not null default (now() + interval '35 minutes'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id text not null references public.product_variants(id),
  product_name text not null,
  variant_label text not null,
  grind text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cop integer not null check (unit_price_cop >= 0),
  line_total_cop integer not null check (line_total_cop >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null references public.product_variants(id),
  order_id uuid references public.orders(id) on delete set null,
  movement_type text not null check (movement_type in ('RESTOCK', 'RESERVE', 'RELEASE', 'SALE', 'ADJUSTMENT')),
  quantity integer not null check (quantity > 0),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_audit_log (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null references public.product_variants(id),
  action text not null,
  previous_values jsonb not null,
  new_values jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_rates (
  city_key text primary key check (city_key ~ '^[a-z0-9-]{2,80}$'),
  city_label text not null,
  price_cop integer not null check (price_cop >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_rate_audit_log (
  id uuid primary key default gen_random_uuid(),
  city_key text not null,
  action text not null,
  previous_values jsonb not null,
  new_values jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.wompi_webhook_events (
  event_key text primary key,
  reference text not null,
  transaction_id text not null,
  transaction_status text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.checkout_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists inventory_variant_idx on public.inventory_movements(variant_id, created_at desc);

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.catalog_audit_log enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.shipping_rate_audit_log enable row level security;
alter table public.wompi_webhook_events enable row level security;
alter table public.checkout_rate_limits enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated using (is_published or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_published or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'))
);
drop policy if exists admin_orders_read on public.orders;
create policy admin_orders_read on public.orders for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists admin_order_items_read on public.order_items;
create policy admin_order_items_read on public.order_items for select to authenticated using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
drop policy if exists admin_order_events_read on public.order_events;
create policy admin_order_events_read on public.order_events for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists admin_inventory_read on public.inventory_movements;
create policy admin_inventory_read on public.inventory_movements for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists admin_catalog_audit_read on public.catalog_audit_log;
create policy admin_catalog_audit_read on public.catalog_audit_log for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists admin_shipping_rates_read on public.shipping_rates;
create policy admin_shipping_rates_read on public.shipping_rates for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists admin_shipping_audit_read on public.shipping_rate_audit_log;
create policy admin_shipping_audit_read on public.shipping_rate_audit_log for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.products, public.product_variants to anon, authenticated;
grant select on public.orders, public.order_items, public.order_events, public.inventory_movements to authenticated;
grant select on public.catalog_audit_log to authenticated;
grant select on public.shipping_rates, public.shipping_rate_audit_log to authenticated;

create or replace view public.storefront_catalog with (security_invoker = true) as
select p.id as product_id, p.slug, p.category, p.name, p.subtitle, p.description, p.process, p.origin, p.altitude, p.notes, p.badge,
  p.image_url, p.sort_order, v.id as variant_id, v.label as variant_label, v.weight_grams, v.price_cop, v.price_confirmed,
  greatest(v.stock_on_hand - v.stock_reserved, 0) as available_stock, v.grinds, coalesce(v.image_url, p.image_url) as variant_image_url, v.sort_order as variant_sort_order
from public.products p join public.product_variants v on v.product_id = p.id
where p.is_published = true and v.is_active = true;
grant select on public.storefront_catalog to anon, authenticated;

create or replace view public.admin_store_metrics with (security_invoker = true) as
select
  coalesce(sum(total_cop) filter (where status in ('PAID','PREPARING','SHIPPED','DELIVERED')), 0)::bigint as paid_revenue_cop,
  coalesce(sum(total_cop) filter (where status in ('PAID','PREPARING','SHIPPED','DELIVERED') and paid_at >= now() - interval '7 days'), 0)::bigint as revenue_7d_cop,
  count(*) filter (where status in ('PAID','PREPARING','SHIPPED','DELIVERED'))::bigint as paid_orders,
  count(*) filter (where status = 'AWAITING_PAYMENT')::bigint as pending_orders,
  count(*)::bigint as total_orders,
  (select count(*) from public.product_variants v where v.is_active and v.stock_on_hand - v.stock_reserved <= 5)::bigint as low_stock_variants
from public.orders;
revoke all on public.admin_store_metrics from anon, authenticated;
grant select on public.admin_store_metrics to service_role;

insert into public.products (id, slug, category, name, subtitle, description, process, origin, altitude, notes, badge, image_url, is_published, sort_order)
values
 ('lena', 'tostado-a-la-lena', 'wood', 'Tostado a la leña', 'La tradición de la casa', 'Cacao oscuro, frutos secos y una nota cítrica suave que termina con el carácter inconfundible de la leña.', 'Tostión a la leña', 'Finca La Libertad · Cachipay', '1.450–1.650 m s. n. m.', array['Cacao','Frutos secos','Final ahumado'], 'El favorito de casa', '/assets/beans.jpg', true, 1),
 ('precision', 'tostion-de-precision', 'precision', 'Tostión de precisión', 'Una taza luminosa y dulce', 'Un perfil amable de naranja y mandarina, acompañado por panela, almendra y chocolate con leche.', 'Tostión media', 'Finca La Libertad · Cachipay', 'Altura por confirmar', array['Naranja','Panela','Almendra'], 'Perfil de taza', '/assets/roasting.jpg', true, 2),
 ('honey', 'microlote-honey', 'honey', 'Microlote Honey', 'Una edición para descubrir', 'Una expresión pequeña de la finca: cuerpo medio-alto, acidez media y una taza para tomar sin afán.', 'Honey · microlote', 'Finca La Libertad · Cachipay', 'Altura por confirmar', array['Cuerpo medio-alto','Acidez media','Lote pequeño'], 'Edición limitada', '/assets/beans-closeup.jpg', true, 3)
on conflict (id) do nothing;

insert into public.product_variants (id, product_id, label, weight_grams, price_cop, price_confirmed, stock_on_hand, grinds, image_url, is_active, sort_order)
values
 ('lena-250', 'lena', '250 g', 250, 0, false, 0, array['Molido'], '/assets/classic-250.jpg', true, 1),
 ('lena-500', 'lena', '500 g', 500, 40000, false, 0, array['Molido','En grano'], '/assets/classic-500-ground.jpg', true, 2),
 ('precision-500', 'precision', '500 g', 500, 0, false, 0, array['Molido'], '/assets/precision-500.jpg', true, 1),
 ('honey-340', 'honey', '340 g · referencia', 340, 35000, false, 0, array['Molido'], '/assets/beans-closeup.jpg', true, 1)
on conflict (id) do nothing;

create or replace function public.consume_checkout_limit(p_fingerprint text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if p_fingerprint !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into public.checkout_rate_limits(fingerprint) values (p_fingerprint) on conflict do nothing;
  update public.checkout_rate_limits
    set request_count = case when window_started_at < now() - interval '1 hour' then 1 else request_count + 1 end,
        window_started_at = case when window_started_at < now() - interval '1 hour' then now() else window_started_at end
    where fingerprint = p_fingerprint returning request_count into v_count;
  return v_count <= 8;
end $$;

create or replace function public.create_checkout_order(
  p_reference text, p_city_key text, p_customer jsonb, p_items jsonb, p_tracking_token_hash text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_quantity integer;
  v_grind text;
  v_subtotal integer := 0;
  v_shipping_cop integer;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if p_reference !~ '^CDT-[A-Z0-9-]{8,60}$' or p_city_key !~ '^[a-z0-9-]{2,80}$' or length(p_tracking_token_hash) <> 64 then raise exception 'invalid checkout'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then raise exception 'invalid items'; end if;
  perform public.expire_checkout_orders();

  select price_cop into v_shipping_cop from public.shipping_rates where city_key = p_city_key and is_active;
  if not found then raise exception 'shipping rate unavailable'; end if;

  insert into public.orders(reference, customer_name, customer_email, customer_phone, city, address, delivery_notes, shipping_cop, total_cop, tracking_token_hash)
  values (p_reference, p_customer->>'name', p_customer->>'email', p_customer->>'phone', p_customer->>'city', p_customer->>'address', coalesce(p_customer->>'notes',''), v_shipping_cop, v_shipping_cop, p_tracking_token_hash)
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    v_grind := v_item->>'grind';
    if v_quantity < 1 or v_quantity > 10 then raise exception 'invalid quantity'; end if;
    select * into v_variant from public.product_variants where id = v_item->>'variantId' and is_active for update;
    if not found or not v_variant.price_confirmed or v_variant.price_cop <= 0 then raise exception 'variant not ready'; end if;
    if not (v_variant.grinds @> array[v_grind]) then raise exception 'grind unavailable'; end if;
    select * into v_product from public.products where id = v_variant.product_id and is_published;
    if not found then raise exception 'product unavailable'; end if;
    if v_variant.stock_on_hand - v_variant.stock_reserved < v_quantity then raise exception 'insufficient stock'; end if;

    update public.product_variants set stock_reserved = stock_reserved + v_quantity, updated_at = now() where id = v_variant.id;
    insert into public.order_items(order_id, variant_id, product_name, variant_label, grind, quantity, unit_price_cop, line_total_cop)
    values (v_order.id, v_variant.id, v_product.name, v_variant.label, v_grind, v_quantity, v_variant.price_cop, v_variant.price_cop * v_quantity);
    insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note)
    values (v_variant.id, v_order.id, 'RESERVE', v_quantity, 'Reserva durante el plazo del checkout Wompi');
    v_subtotal := v_subtotal + v_variant.price_cop * v_quantity;
  end loop;

  update public.orders set subtotal_cop = v_subtotal, total_cop = v_subtotal + v_shipping_cop, updated_at = now() where id = v_order.id returning * into v_order;
  insert into public.order_events(order_id, status, message) values (v_order.id, v_order.status, 'Pedido recibido y unidades reservadas para pago.');
  return jsonb_build_object('id', v_order.id, 'reference', v_order.reference, 'subtotal_cop', v_order.subtotal_cop, 'shipping_cop', v_order.shipping_cop, 'total_cop', v_order.total_cop);
end $$;

create or replace function public.settle_wompi_transaction(
  p_event_key text, p_reference text, p_transaction_id text, p_status text, p_amount_in_cents bigint, p_currency text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_final text;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if p_status not in ('APPROVED','DECLINED','ERROR','VOIDED') then return true; end if;
  insert into public.wompi_webhook_events(event_key, reference, transaction_id, transaction_status)
  values (p_event_key, p_reference, p_transaction_id, p_status) on conflict do nothing;
  if not found then return true; end if;
  select * into v_order from public.orders where reference = p_reference for update;
  if not found or p_currency <> 'COP' or p_amount_in_cents <> v_order.total_cop::bigint * 100 then return false; end if;
  if v_order.status <> 'AWAITING_PAYMENT' then return true; end if;

  if p_status = 'APPROVED' then
    update public.orders set status = 'PAID', wompi_transaction_id = p_transaction_id, paid_at = now(), updated_at = now() where id = v_order.id;
    for v_item in select variant_id, quantity from public.order_items where order_id = v_order.id loop
      update public.product_variants set stock_on_hand = stock_on_hand - v_item.quantity, stock_reserved = stock_reserved - v_item.quantity, updated_at = now() where id = v_item.variant_id;
      insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note) values (v_item.variant_id, v_order.id, 'SALE', v_item.quantity, 'Venta pagada por Wompi');
    end loop;
    v_final := 'PAID';
  else
    update public.orders set status = 'CANCELLED', wompi_transaction_id = p_transaction_id, updated_at = now() where id = v_order.id;
    for v_item in select variant_id, quantity from public.order_items where order_id = v_order.id loop
      update public.product_variants set stock_reserved = stock_reserved - v_item.quantity, updated_at = now() where id = v_item.variant_id;
      insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note) values (v_item.variant_id, v_order.id, 'RELEASE', v_item.quantity, 'Reserva liberada tras pago no aprobado');
    end loop;
    v_final := 'CANCELLED';
  end if;
  insert into public.order_events(order_id, status, message) values (v_order.id, v_final, 'Estado confirmado por notificación firmada de Wompi.');
  return true;
end $$;

create or replace function public.expire_checkout_orders()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_item record; v_expired integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  for v_order in select * from public.orders where status = 'AWAITING_PAYMENT' and expires_at < now() for update skip locked loop
    for v_item in select variant_id, quantity from public.order_items where order_id = v_order.id loop
      update public.product_variants set stock_reserved = stock_reserved - v_item.quantity, updated_at = now() where id = v_item.variant_id;
      insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note) values (v_item.variant_id, v_order.id, 'RELEASE', v_item.quantity, 'Reserva vencida');
    end loop;
    update public.orders set status = 'CANCELLED', updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id, status, message) values (v_order.id, 'CANCELLED', 'La reserva venció antes de completar el pago.');
    v_expired := v_expired + 1;
  end loop;
  return v_expired;
end $$;

create or replace function public.admin_adjust_inventory(p_variant_id text, p_delta integer, p_note text, p_admin_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_variant public.product_variants%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if p_delta = 0 or abs(p_delta) > 10000 then raise exception 'invalid adjustment'; end if;
  select * into v_variant from public.product_variants where id = p_variant_id and is_active for update;
  if not found or v_variant.stock_on_hand + p_delta < v_variant.stock_reserved then return false; end if;
  update public.product_variants set stock_on_hand = stock_on_hand + p_delta, updated_at = now() where id = p_variant_id;
  insert into public.inventory_movements(variant_id, movement_type, quantity, note, created_by)
  values (p_variant_id, case when p_delta > 0 then 'RESTOCK' else 'ADJUSTMENT' end, abs(p_delta), left(p_note,200), p_admin_id);
  return true;
end $$;

create or replace function public.admin_configure_variant(p_variant_id text, p_label text, p_weight_grams integer, p_price_cop integer, p_price_confirmed boolean, p_admin_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_variant public.product_variants%rowtype; v_previous jsonb; v_next jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if length(trim(p_label)) < 2 or length(p_label) > 60 or p_weight_grams < 50 or p_weight_grams > 20000 or p_price_cop < 0 or p_price_cop > 100000000 then raise exception 'invalid variant values'; end if;
  if p_price_confirmed and p_price_cop = 0 then raise exception 'confirmed price must be positive'; end if;
  select * into v_variant from public.product_variants where id = p_variant_id for update;
  if not found then return false; end if;
  v_previous := jsonb_build_object('label',v_variant.label,'weight_grams',v_variant.weight_grams,'price_cop',v_variant.price_cop,'price_confirmed',v_variant.price_confirmed);
  v_next := jsonb_build_object('label',trim(p_label),'weight_grams',p_weight_grams,'price_cop',p_price_cop,'price_confirmed',p_price_confirmed);
  update public.product_variants set label = trim(p_label), weight_grams = p_weight_grams, price_cop = p_price_cop, price_confirmed = p_price_confirmed, updated_at = now() where id = p_variant_id;
  insert into public.catalog_audit_log(variant_id, action, previous_values, new_values, changed_by) values (p_variant_id, 'VARIANT_UPDATED', v_previous, v_next, p_admin_id);
  return true;
end $$;

create or replace function public.admin_configure_shipping_rate(p_city_key text, p_city_label text, p_price_cop integer, p_active boolean, p_admin_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_previous jsonb; v_next jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if p_city_key !~ '^[a-z0-9-]{2,80}$' or length(trim(p_city_label)) < 2 or length(p_city_label) > 80 or p_price_cop < 0 or p_price_cop > 100000000 then raise exception 'invalid shipping rate'; end if;
  select jsonb_build_object('city_label',city_label,'price_cop',price_cop,'is_active',is_active) into v_previous from public.shipping_rates where city_key = p_city_key for update;
  v_previous := coalesce(v_previous, '{}'::jsonb);
  v_next := jsonb_build_object('city_label',trim(p_city_label),'price_cop',p_price_cop,'is_active',p_active);
  insert into public.shipping_rates(city_key, city_label, price_cop, is_active, updated_at)
  values (p_city_key, trim(p_city_label), p_price_cop, p_active, now())
  on conflict (city_key) do update set city_label = excluded.city_label, price_cop = excluded.price_cop, is_active = excluded.is_active, updated_at = now();
  insert into public.shipping_rate_audit_log(city_key, action, previous_values, new_values, changed_by) values (p_city_key, 'RATE_UPDATED', v_previous, v_next, p_admin_id);
  return true;
end $$;

create or replace function public.admin_update_order(p_order_id uuid, p_status text, p_tracking_url text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if p_status not in ('PREPARING','SHIPPED','DELIVERED','CANCELLED') then raise exception 'invalid status'; end if;
  if p_status = 'SHIPPED' and (p_tracking_url is null or p_tracking_url !~ '^https://') then raise exception 'tracking url required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status not in ('PAID','PREPARING','SHIPPED') then return false; end if;
  if p_status = 'CANCELLED' and v_order.status in ('PAID','PREPARING','SHIPPED') then return false; end if;
  update public.orders set status = p_status, courier_tracking_url = nullif(left(p_tracking_url,500),''), updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, status, message) values (p_order_id, p_status, case p_status when 'PREPARING' then 'Tu pedido está en preparación.' when 'SHIPPED' then 'Tu pedido salió a despacho.' else 'Tu pedido fue entregado.' end);
  return true;
end $$;

revoke all on function public.consume_checkout_limit(text) from public, anon, authenticated;
revoke all on function public.create_checkout_order(text,text,jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.settle_wompi_transaction(text,text,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.expire_checkout_orders() from public, anon, authenticated;
revoke all on function public.admin_adjust_inventory(text,integer,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_configure_variant(text,text,integer,integer,boolean,uuid) from public, anon, authenticated;
revoke all on function public.admin_configure_shipping_rate(text,text,integer,boolean,uuid) from public, anon, authenticated;
revoke all on function public.admin_update_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.consume_checkout_limit(text) to service_role;
grant execute on function public.create_checkout_order(text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.settle_wompi_transaction(text,text,text,text,bigint,text) to service_role;
grant execute on function public.expire_checkout_orders() to service_role;
grant execute on function public.admin_adjust_inventory(text,integer,text,uuid) to service_role;
grant execute on function public.admin_configure_variant(text,text,integer,integer,boolean,uuid) to service_role;
grant execute on function public.admin_configure_shipping_rate(text,text,integer,boolean,uuid) to service_role;
grant execute on function public.admin_update_order(uuid,text,text) to service_role;

-- Seed values are references only; all start unpublished for checkout readiness purposes
-- through price_confirmed=false and stock_on_hand=0. Confirm with the business before selling.
