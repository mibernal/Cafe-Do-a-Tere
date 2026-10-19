-- Harden the public database surface and make checkout, payment reconciliation,
-- privacy consent, and order transitions safer for an operational store.

drop view if exists public.storefront_catalog;
drop view if exists public.admin_store_metrics;

alter table public.orders
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_policy_version text,
  add column if not exists payment_review_reason text;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('AWAITING_PAYMENT', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PAYMENT_REVIEW'));

-- COP amounts can exceed a 32-bit integer when a basket contains several units.
alter table public.product_variants alter column price_cop type bigint;
alter table public.orders
  alter column subtotal_cop type bigint,
  alter column shipping_cop type bigint,
  alter column total_cop type bigint;
alter table public.order_items
  alter column unit_price_cop type bigint,
  alter column line_total_cop type bigint;

create index if not exists order_events_order_created_idx
  on public.order_events(order_id, created_at desc);

-- The browser should only receive the curated catalog view, never raw inventory.
create view public.storefront_catalog with (security_barrier = true) as
select p.id as product_id, p.slug, p.category, p.name, p.subtitle, p.description, p.process, p.origin, p.altitude, p.notes, p.badge,
  p.image_url, p.sort_order, v.id as variant_id, v.label as variant_label, v.weight_grams, v.price_cop, v.price_confirmed,
  case when v.stock_on_hand > v.stock_reserved then 1 else 0 end as available_stock,
  v.grinds, coalesce(v.image_url, p.image_url) as variant_image_url, v.sort_order as variant_sort_order
from public.products p
join public.product_variants v on v.product_id = p.id
where p.is_published = true and v.is_active = true;
alter view public.storefront_catalog set (security_invoker = false);
revoke all on public.products, public.product_variants from public, anon, authenticated;
revoke all on public.storefront_catalog from public;
grant select on public.storefront_catalog to anon, authenticated;

create view public.admin_store_metrics with (security_invoker = true) as
select
  coalesce(sum(total_cop) filter (where status in ('PAID','PREPARING','SHIPPED','DELIVERED')), 0)::bigint as paid_revenue_cop,
  coalesce(sum(total_cop) filter (where status in ('PAID','PREPARING','SHIPPED','DELIVERED') and paid_at >= now() - interval '7 days'), 0)::bigint as revenue_7d_cop,
  count(*) filter (where status in ('PAID','PREPARING','SHIPPED','DELIVERED'))::bigint as paid_orders,
  count(*) filter (where status = 'AWAITING_PAYMENT')::bigint as pending_orders,
  count(*)::bigint as total_orders,
  (select count(*) from public.product_variants v where v.is_active and v.stock_on_hand - v.stock_reserved <= 5)::bigint as low_stock_variants,
  count(*) filter (where payment_review_reason is not null)::bigint as payment_review_orders
from public.orders;
revoke all on public.admin_store_metrics from public, anon, authenticated;
grant select on public.admin_store_metrics to service_role;

create table if not exists public.admin_login_rate_limits (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
create index if not exists admin_login_rate_limits_window_idx on public.admin_login_rate_limits(window_started_at);
alter table public.admin_login_rate_limits enable row level security;
revoke all on public.admin_login_rate_limits from public, anon, authenticated;

create or replace function public.consume_admin_login_limit(p_fingerprint text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_fingerprint !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into public.admin_login_rate_limits(fingerprint) values (p_fingerprint) on conflict do nothing;
  update public.admin_login_rate_limits
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
  v_subtotal bigint := 0;
  v_shipping_cop bigint;
  v_policy_version text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_reference !~ '^CDT-[A-Z0-9-]{8,60}$' or p_city_key !~ '^[a-z0-9-]{2,80}$' or length(p_tracking_token_hash) <> 64 then raise exception 'invalid checkout'; end if;
  if coalesce(p_customer->>'privacyConsent', 'false') <> 'true' then raise exception 'privacy consent required'; end if;
  v_policy_version := p_customer->>'privacyPolicyVersion';
  if v_policy_version is null or length(trim(v_policy_version)) < 1 or length(v_policy_version) > 80 or lower(v_policy_version) like '%draft%' then raise exception 'privacy policy is not ready'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then raise exception 'invalid items'; end if;
  perform public.expire_checkout_orders();

  select price_cop into v_shipping_cop from public.shipping_rates where city_key = p_city_key and is_active;
  if not found then raise exception 'shipping rate unavailable'; end if;

  insert into public.orders(reference, customer_name, customer_email, customer_phone, city, address, delivery_notes, shipping_cop, total_cop, tracking_token_hash, privacy_consent_at, privacy_policy_version)
  values (p_reference, p_customer->>'name', p_customer->>'email', p_customer->>'phone', p_customer->>'city', p_customer->>'address', coalesce(p_customer->>'notes',''), v_shipping_cop, v_shipping_cop, p_tracking_token_hash, now(), v_policy_version)
  returning * into v_order;

  for v_item in
    select entry.value
    from jsonb_array_elements(p_items) as entry(value)
    order by entry.value->>'variantId', entry.value->>'grind'
  loop
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

create or replace function public.cancel_checkout_order(p_reference text, p_reason text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_item record;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  select * into v_order from public.orders where reference = p_reference for update;
  if not found or v_order.status <> 'AWAITING_PAYMENT' then return false; end if;
  for v_item in select variant_id, quantity from public.order_items where order_id = v_order.id loop
    update public.product_variants set stock_reserved = stock_reserved - v_item.quantity, updated_at = now() where id = v_item.variant_id;
    insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note) values (v_item.variant_id, v_order.id, 'RELEASE', v_item.quantity, 'Reserva liberada al preparar el pago');
  end loop;
  update public.orders set status = 'CANCELLED', updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, status, message) values (v_order.id, 'CANCELLED', left(coalesce(p_reason, 'No fue posible preparar el pago.'), 200));
  return true;
end $$;

create or replace function public.settle_wompi_transaction(
  p_event_key text, p_reference text, p_transaction_id text, p_status text, p_amount_in_cents bigint, p_currency text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_variant public.product_variants%rowtype;
  v_has_stock boolean := true;
  v_final text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_event_key is null or p_event_key !~ '^[a-f0-9]{64}$' or p_reference is null or length(p_reference) > 80 or p_transaction_id is null or length(p_transaction_id) > 120 then return false; end if;
  if p_status is null or p_status not in ('APPROVED','DECLINED','ERROR','VOIDED') then return false; end if;

  select * into v_order from public.orders where reference = p_reference for update;
  if not found or p_currency is distinct from 'COP' or p_amount_in_cents is null or p_amount_in_cents <> v_order.total_cop::bigint * 100 then return false; end if;

  insert into public.wompi_webhook_events(event_key, reference, transaction_id, transaction_status)
  values (p_event_key, p_reference, p_transaction_id, p_status) on conflict do nothing;
  if not found then return true; end if;

  if v_order.status = 'AWAITING_PAYMENT' then
    if p_status = 'APPROVED' then
      update public.orders set status = 'PAID', wompi_transaction_id = p_transaction_id, paid_at = now(), updated_at = now() where id = v_order.id;
      for v_item in select variant_id, quantity from public.order_items where order_id = v_order.id loop
        update public.product_variants set stock_on_hand = stock_on_hand - v_item.quantity, stock_reserved = stock_reserved - v_item.quantity, updated_at = now() where id = v_item.variant_id;
        insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note) values (v_item.variant_id, v_order.id, 'SALE', v_item.quantity, 'Venta pagada por Wompi');
      end loop;
      v_final := 'PAID';
      insert into public.order_events(order_id, status, message) values (v_order.id, v_final, 'Pago confirmado por Wompi.');
    else
      update public.orders set status = 'CANCELLED', updated_at = now() where id = v_order.id;
      for v_item in select variant_id, quantity from public.order_items where order_id = v_order.id loop
        update public.product_variants set stock_reserved = stock_reserved - v_item.quantity, updated_at = now() where id = v_item.variant_id;
        insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note) values (v_item.variant_id, v_order.id, 'RELEASE', v_item.quantity, 'Reserva liberada tras pago no aprobado');
      end loop;
      insert into public.order_events(order_id, status, message) values (v_order.id, 'CANCELLED', 'El pago no fue aprobado y liberamos la reserva.');
    end if;
    return true;
  end if;

  if p_status = 'APPROVED' and v_order.status = 'CANCELLED' then
    -- A delayed but valid approval must not disappear after the reservation expires.
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      select * into v_variant from public.product_variants where id = v_item.variant_id for update;
      if not found or v_variant.stock_on_hand - v_variant.stock_reserved < v_item.quantity then
        v_has_stock := false;
      end if;
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
      update public.orders set status = 'PAID', wompi_transaction_id = p_transaction_id, paid_at = now(), updated_at = now() where id = v_order.id;
      insert into public.order_events(order_id, status, message) values (v_order.id, 'PAID', 'Pago confirmado; verificamos disponibilidad después de recibir la notificación.');
    else
      update public.orders set status = 'PAYMENT_REVIEW', wompi_transaction_id = p_transaction_id, paid_at = now(),
        payment_review_reason = 'Pago aprobado después de vencer la reserva; revisar inventario y contactar al cliente.', updated_at = now()
      where id = v_order.id;
      insert into public.order_events(order_id, status, message) values (v_order.id, 'PAYMENT_REVIEW', 'El pago fue aprobado y estamos confirmando la disponibilidad de inventario.');
    end if;
    return true;
  end if;

  if p_status = 'APPROVED' and v_order.wompi_transaction_id is not null and v_order.wompi_transaction_id <> p_transaction_id then
    update public.orders set payment_review_reason = 'Se recibió más de un pago aprobado para esta referencia; verificar y gestionar el pago duplicado.', updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id, status, message) values (v_order.id, v_order.status, 'Estamos revisando una novedad relacionada con el pago.');
  end if;
  return true;
end $$;

create or replace function public.expire_checkout_orders()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_item record; v_expired integer := 0;
begin
  -- Only service-role API calls and trusted database jobs may execute this function.
  if auth.role() is not null and auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
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

create or replace function public.admin_update_order(p_order_id uuid, p_status text, p_tracking_url text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_variant public.product_variants%rowtype;
  v_has_stock boolean := true;
  v_message text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_status not in ('PREPARING','SHIPPED','DELIVERED') then raise exception 'invalid status'; end if;
  if p_status = 'SHIPPED' and (p_tracking_url is null or p_tracking_url !~ '^https://') then raise exception 'tracking url required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;

  if p_status = 'PREPARING' and v_order.status = 'PAYMENT_REVIEW' then
    -- Reconcile stock atomically before an operator commits a paid order to fulfillment.
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      select * into v_variant from public.product_variants where id = v_item.variant_id for update;
      if not found or v_variant.stock_on_hand - v_variant.stock_reserved < v_item.quantity then
        v_has_stock := false;
      end if;
    end loop;
    if not v_has_stock then return false; end if;

    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = v_order.id group by variant_id order by variant_id
    loop
      update public.product_variants set stock_on_hand = stock_on_hand - v_item.quantity, updated_at = now() where id = v_item.variant_id;
      insert into public.inventory_movements(variant_id, order_id, movement_type, quantity, note)
      values (v_item.variant_id, v_order.id, 'SALE', v_item.quantity, 'Pago conciliado; inventario validado para preparación');
    end loop;
    v_message := 'La disponibilidad fue validada y el pedido pasa a preparación.';
  elsif p_status = 'PREPARING' and v_order.status = 'PAID' then
    v_message := 'Tu pedido está en preparación.';
  elsif p_status = 'SHIPPED' and v_order.status = 'PREPARING' then
    v_message := 'Tu pedido salió a despacho.';
  elsif p_status = 'DELIVERED' and v_order.status = 'SHIPPED' then
    v_message := 'Tu pedido fue entregado.';
  else
    return false;
  end if;

  update public.orders set status = p_status,
    courier_tracking_url = case when p_status = 'SHIPPED' then left(p_tracking_url,500) else courier_tracking_url end,
    payment_review_reason = case when v_order.status = 'PAYMENT_REVIEW' then null else payment_review_reason end,
    updated_at = now()
  where id = p_order_id;
  insert into public.order_events(order_id, status, message) values (p_order_id, p_status, v_message);
  return true;
end $$;

create or replace function public.prune_store_rate_limits()
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_deleted bigint := 0; v_rows bigint := 0;
begin
  if auth.role() is not null and auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  delete from public.checkout_rate_limits where window_started_at < now() - interval '24 hours';
  get diagnostics v_rows = row_count;
  v_deleted := v_deleted + v_rows;
  delete from public.admin_login_rate_limits where window_started_at < now() - interval '24 hours';
  get diagnostics v_rows = row_count;
  return v_deleted + v_rows;
end $$;

revoke all on function public.consume_admin_login_limit(text) from public, anon, authenticated;
revoke all on function public.cancel_checkout_order(text,text) from public, anon, authenticated;
revoke all on function public.prune_store_rate_limits() from public, anon, authenticated;
revoke all on function public.create_checkout_order(text,text,jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.settle_wompi_transaction(text,text,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.expire_checkout_orders() from public, anon, authenticated;
revoke all on function public.admin_update_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.consume_admin_login_limit(text) to service_role;
grant execute on function public.cancel_checkout_order(text,text) to service_role;
grant execute on function public.prune_store_rate_limits() to service_role;
grant execute on function public.create_checkout_order(text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.settle_wompi_transaction(text,text,text,text,bigint,text) to service_role;
grant execute on function public.expire_checkout_orders() to service_role;
grant execute on function public.admin_update_order(uuid,text,text) to service_role;
