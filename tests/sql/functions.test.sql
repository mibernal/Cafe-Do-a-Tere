-- Pruebas de las funciones de la tienda. Ejecuta 00_supabase_stub.sql y las
-- migraciones en una base vacía antes de este archivo (ver tests/README.md).
\set ON_ERROR_STOP 1
\pset pager off
-- ---------------------------------------------------------------- anon surface
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select count(*) as anon_catalog_rows from public.storefront_catalog_items();
select count(*) as anon_zones from public.storefront_shipping_zones();
do $$ begin
  begin perform * from public.orders; raise exception 'FAIL anon read orders'; exception when insufficient_privilege then raise notice 'ok: anon cannot read orders'; end;
  begin perform * from public.products; raise exception 'FAIL anon read products'; exception when insufficient_privilege then raise notice 'ok: anon cannot read products'; end;
  begin perform * from public.shipping_rates; raise exception 'FAIL anon read rates'; exception when insufficient_privilege then raise notice 'ok: anon cannot read shipping_rates'; end;
  begin perform public.create_checkout_order('CDT-AAAAAAAA-1','bogota','{}'::jsonb,'[]'::jsonb, repeat('a',64),'WOMPI',1); raise exception 'FAIL anon checkout'; exception when insufficient_privilege then raise notice 'ok: anon cannot create orders'; end;
  begin perform public.admin_adjust_inventory('lena-500', 5, 'x', null); raise exception 'FAIL anon admin'; exception when insufficient_privilege then raise notice 'ok: anon cannot adjust inventory'; end;
  begin perform public.valid_grind_options(array['En grano']); raise exception 'FAIL anon helper'; exception when insufficient_privilege then raise notice 'ok: anon cannot call helper'; end;
  begin perform * from public.admin_store_metrics; raise exception 'FAIL anon metrics'; exception when insufficient_privilege then raise notice 'ok: anon cannot read metrics'; end;
end $$;
reset role;

-- authenticated non-admin
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{}}', false);
select count(*) as non_admin_orders_visible from public.orders;
do $$ begin
  begin perform public.settle_wompi_transaction(repeat('a',64),'x','x','APPROVED',1,'COP'); raise exception 'FAIL auth settle'; exception when insufficient_privilege then raise notice 'ok: authenticated cannot settle'; end;
  begin truncate public.orders; raise exception 'FAIL auth truncate'; exception when insufficient_privilege then raise notice 'ok: authenticated cannot truncate orders'; end;
end $$;
reset role;

-- 007: ni anon ni authenticated escriben directo en tablas o secuencias, y un
-- objeto nuevo en public no queda expuesto por defecto.
do $$
declare exposed text;
begin
  select string_agg(format('%s:%s:%s', r, c.relname, p), ', ') into exposed
  from pg_class c join pg_namespace n on n.oid = c.relnamespace,
       unnest(array['anon','authenticated']) r,
       unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
  where n.nspname = 'public' and c.relkind in ('r','v','m','p') and has_table_privilege(r, c.oid, p);
  if exposed is not null then raise exception 'FAIL write privileges: %', exposed; end if;
  raise notice 'ok: anon/authenticated have no write privileges on public tables';

  create table public.zz_privilege_probe (id int);
  create function public.zz_privilege_probe_fn() returns int language sql as 'select 1';
  if has_table_privilege('anon', 'public.zz_privilege_probe', 'SELECT')
     or has_table_privilege('authenticated', 'public.zz_privilege_probe', 'SELECT')
     or has_function_privilege('anon', 'public.zz_privilege_probe_fn()', 'EXECUTE') then
    raise exception 'FAIL new objects exposed by default';
  end if;
  drop function public.zz_privilege_probe_fn();
  drop table public.zz_privilege_probe;
  raise notice 'ok: new public objects are not exposed by default';
end $$;

-- ---------------------------------------------------------------- service role setup
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);

select public.admin_configure_variant('lena-500', '500 g', 500, 42000, true,
  array['Espresso · fina','Prensa francesa · gruesa','En grano'], true, null) as cfg_lena500;
select public.admin_configure_variant('honey-red-250', '250 g', 250, 26000, true,
  array['V60 / filtro manual · media','En grano'], true, null) as cfg_honeyred250;
do $$ begin
  begin perform public.admin_configure_variant('lena-500', '500 g', 500, 0, true, array['En grano'], true, null); raise exception 'FAIL zero confirmed price'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: zero confirmed price rejected'; end;
  begin perform public.admin_configure_variant('lena-500', '500 g', 500, 1000, true, array['Molido raro'], true, null); raise exception 'FAIL bad grind'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: invalid grind rejected'; end;
end $$;
select public.admin_adjust_inventory('lena-500', 10, 'Ingreso inicial', null) as stock_lena;
select public.admin_adjust_inventory('honey-red-250', 4, 'Ingreso inicial', null) as stock_honeyred;
-- 005: solo los tres cafés vigentes quedan publicados, y un café oculto no se
-- puede comprar aunque tenga precio confirmado.
select string_agg(id, ',' order by sort_order) as published_products from public.products where is_published;
select public.admin_configure_variant('lavado-250', '250 g', 250, 26000, true, array['En grano'], true, null) as cfg_hidden_lavado;
select public.admin_adjust_inventory('lavado-250', 2, 'Lote de prueba', null) as stock_hidden_lavado;
select public.admin_configure_shipping_rate('bogota', 'Bogotá', 12000, true, true, '1 a 2 días hábiles', null) as rate_bog;
select public.admin_configure_shipping_rate('cachipay', 'Cachipay', 0, true, false, 'Mismo día', null) as rate_cachipay;
select * from public.storefront_shipping_zones();
select variant_id, price_cop, price_confirmed, available_stock, low_stock from public.storefront_catalog_items() where variant_id in ('lena-500','honey-red-250');

-- ---------------------------------------------------------------- Wompi order happy path
do $$ begin
  begin perform public.create_checkout_order('CDT-HIDDEN-0001', 'bogota', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"lavado-250","grind":"En grano","quantity":1}]'::jsonb, repeat('9',64), 'WOMPI', 1); raise exception 'FAIL hidden product sold'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end;
end $$;
select count(*) filter (where product_id = 'lavado') as hidden_rows_in_storefront from public.storefront_catalog_items();

select public.create_checkout_order('CDT-WOMPI-0001', 'bogota',
  '{"name":"Ana Pérez","email":"Ana@Example.com","phone":"3001234567","address":"Calle 1 # 2-3","notes":"Apto 101","privacyConsent":true,"privacyPolicyVersion":"2026-10-v1","documentType":"CC","documentNumber":"10203040"}'::jsonb,
  '[{"variantId":"lena-500","grind":"En grano","quantity":2},{"variantId":"honey-red-250","grind":"V60 / filtro manual · media","quantity":1}]'::jsonb,
  repeat('a', 64), 'WOMPI', 300000) as wompi_order;
select id, stock_on_hand, stock_reserved from public.product_variants where id in ('lena-500','honey-red-250') order by id;
select public.settle_wompi_transaction(encode(sha256('evt1'),'hex'), 'CDT-WOMPI-0001', 'tx-1', 'APPROVED', (42000*2+26000+12000)::bigint*100, 'COP') as settled;
select public.settle_wompi_transaction(encode(sha256('evt1'),'hex'), 'CDT-WOMPI-0001', 'tx-1', 'APPROVED', (42000*2+26000+12000)::bigint*100, 'COP') as settled_duplicate;
select reference, status, paid_at is not null as paid, customer_email, city, subtotal_cop, shipping_cop, total_cop from public.orders where reference = 'CDT-WOMPI-0001';
select id, stock_on_hand, stock_reserved from public.product_variants where id in ('lena-500','honey-red-250') order by id;
-- second approved payment for the same reference raises a review flag
select public.settle_wompi_transaction(encode(sha256('evt2'),'hex'), 'CDT-WOMPI-0001', 'tx-2', 'APPROVED', (42000*2+26000+12000)::bigint*100, 'COP') as dup_payment;
select status, payment_review_reason is not null as flagged from public.orders where reference = 'CDT-WOMPI-0001';
select public.admin_resolve_payment_review((select id from public.orders where reference='CDT-WOMPI-0001'), 'Reembolsado tx-2 en Wompi', null) as resolved;
-- wrong amount is rejected
select public.settle_wompi_transaction(encode(sha256('evt3'),'hex'), 'CDT-WOMPI-0001', 'tx-1', 'APPROVED', 1, 'COP') as wrong_amount_false;

-- ---------------------------------------------------------------- validation failures
do $$ begin
  begin perform public.create_checkout_order('CDT-BAD-00001', 'bogota', '{"name":"A","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"lena-500","grind":"En grano","quantity":1}]'::jsonb, repeat('b',64), 'WOMPI', 1); raise exception 'FAIL short name'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: invalid customer rejected: %', sqlerrm; end;
  begin perform public.create_checkout_order('CDT-BAD-00002', 'bogota', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"draft"}'::jsonb, '[{"variantId":"lena-500","grind":"En grano","quantity":1}]'::jsonb, repeat('b',64), 'WOMPI', 1); raise exception 'FAIL draft policy'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: draft policy rejected'; end;
  begin perform public.create_checkout_order('CDT-BAD-00003', 'medellin', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"lena-500","grind":"En grano","quantity":1}]'::jsonb, repeat('b',64), 'WOMPI', 1); raise exception 'FAIL city'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end;
  begin perform public.create_checkout_order('CDT-BAD-00004', 'bogota', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"precision-500","grind":"Espresso · fina","quantity":1}]'::jsonb, repeat('b',64), 'WOMPI', 1); raise exception 'FAIL unconfirmed'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end;
  begin perform public.create_checkout_order('CDT-BAD-00005', 'bogota', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"lena-500","grind":"Chemex · media-gruesa","quantity":1}]'::jsonb, repeat('b',64), 'WOMPI', 1); raise exception 'FAIL grind'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end;
  begin perform public.create_checkout_order('CDT-BAD-00006', 'bogota', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"honey-red-250","grind":"En grano","quantity":9}]'::jsonb, repeat('b',64), 'WOMPI', 1); raise exception 'FAIL stock'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end;
  begin perform public.create_checkout_order('CDT-BAD-00007', 'cachipay', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"lena-500","grind":"En grano","quantity":1}]'::jsonb, repeat('b',64), 'CASH_ON_DELIVERY', 999999); raise exception 'FAIL cod city'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end;
  begin perform public.create_checkout_order('CDT-BAD-00008', 'bogota', '{"name":"Ana","email":"a@b.co","phone":"3001234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"lena-500","grind":"En grano","quantity":3}]'::jsonb, repeat('b',64), 'CASH_ON_DELIVERY', 100000); raise exception 'FAIL cod max'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: %', sqlerrm; end;
  begin perform public.create_checkout_order('CDT-BAD-00009', 'bogota', '{"name":"Ana","email":"a@b.co","phone":"6011234567","address":"Calle 1 # 2","privacyConsent":true,"privacyPolicyVersion":"v1"}'::jsonb, '[{"variantId":"lena-500","grind":"En grano","quantity":1}]'::jsonb, repeat('b',64), 'WOMPI', 1); raise exception 'FAIL phone'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: landline rejected'; end;
end $$;
select count(*) as orders_after_failures from public.orders;
select id, stock_on_hand, stock_reserved from public.product_variants where id in ('lena-500','honey-red-250') order by id;

-- ---------------------------------------------------------------- COD flow
select public.create_checkout_order('CDT-COD-00001', 'bogota',
  '{"name":"Luis Gómez","email":"luis@example.com","phone":"3109876543","address":"Carrera 7 # 45-10","privacyConsent":true,"privacyPolicyVersion":"2026-10-v1"}'::jsonb,
  '[{"variantId":"lena-500","grind":"Prensa francesa · gruesa","quantity":2}]'::jsonb,
  repeat('c', 64), 'CASH_ON_DELIVERY', 300000) as cod_order;
select status, payment_method, expires_at > now() + interval '71 hours' as expires_72h from public.orders where reference = 'CDT-COD-00001';
select public.settle_wompi_transaction(encode(sha256('evt-cod'),'hex'), 'CDT-COD-00001', 'tx-9', 'APPROVED', (42000*2+12000)::bigint*100, 'COP') as wompi_on_cod_false;
select public.admin_update_order((select id from public.orders where reference='CDT-COD-00001'), 'PREPARING', null, null, null, null) as cod_confirmed;
select id, stock_on_hand, stock_reserved from public.product_variants where id = 'lena-500';
do $$ begin
  begin perform public.admin_update_order((select id from public.orders where reference='CDT-COD-00001'), 'SHIPPED', 'http://insecure', null, null, null); raise exception 'FAIL insecure url'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: insecure tracking url rejected'; end;
end $$;
select public.admin_update_order((select id from public.orders where reference='CDT-COD-00001'), 'SHIPPED', '', 'Mensajero de la finca', '', null) as shipped_no_url;
select * from public.admin_store_metrics;
select public.admin_update_order((select id from public.orders where reference='CDT-COD-00001'), 'DELIVERED', null, null, null, null) as delivered;
select status, paid_at is not null as cash_collected, courier_name from public.orders where reference = 'CDT-COD-00001';

-- ---------------------------------------------------------------- customer cancel by token, expiry, late approval
select public.create_checkout_order('CDT-WOMPI-0002', 'bogota',
  '{"name":"Marta Ruiz","email":"marta@example.com","phone":"3201112233","address":"Av 68 # 10-20","privacyConsent":true,"privacyPolicyVersion":"2026-10-v1"}'::jsonb,
  '[{"variantId":"honey-red-250","grind":"En grano","quantity":3}]'::jsonb, repeat('d', 64), 'WOMPI', 300000) is not null as created;
select stock_on_hand, stock_reserved from public.product_variants where id = 'honey-red-250';
select public.cancel_checkout_by_token(repeat('d', 64)) as customer_cancelled;
select public.cancel_checkout_by_token(repeat('d', 64)) as second_cancel_false;
select stock_on_hand, stock_reserved from public.product_variants where id = 'honey-red-250';

select public.create_checkout_order('CDT-WOMPI-0003', 'bogota',
  '{"name":"Marta Ruiz","email":"marta@example.com","phone":"3201112233","address":"Av 68 # 10-20","privacyConsent":true,"privacyPolicyVersion":"2026-10-v1"}'::jsonb,
  '[{"variantId":"honey-red-250","grind":"En grano","quantity":2}]'::jsonb, repeat('e', 64), 'WOMPI', 300000) is not null as created;
reset role;
update public.orders set expires_at = now() - interval '1 minute' where reference = 'CDT-WOMPI-0003';
set role service_role;
select public.expire_checkout_orders() as expired;
select status, cancelled_reason from public.orders where reference = 'CDT-WOMPI-0003';
select public.settle_wompi_transaction(encode(sha256('evt-late'),'hex'), 'CDT-WOMPI-0003', 'tx-late', 'APPROVED', (26000*2+12000)::bigint*100, 'COP') as late_approval;
select status, paid_at is not null as paid from public.orders where reference = 'CDT-WOMPI-0003';
select stock_on_hand, stock_reserved from public.product_variants where id = 'honey-red-250';

-- refund with restock
select public.admin_close_order((select id from public.orders where reference='CDT-WOMPI-0003'), 'REFUND', true, 'Cliente desistió (retracto)', null) as refunded;
select status from public.orders where reference = 'CDT-WOMPI-0003';
select stock_on_hand, stock_reserved from public.product_variants where id = 'honey-red-250';
-- cancel paid order not allowed
select public.admin_close_order((select id from public.orders where reference='CDT-WOMPI-0001'), 'CANCEL', true, 'prueba', null) as cancel_paid_false;

-- declined path
select public.create_checkout_order('CDT-WOMPI-0004', 'bogota',
  '{"name":"Marta Ruiz","email":"marta@example.com","phone":"3201112233","address":"Av 68 # 10-20","privacyConsent":true,"privacyPolicyVersion":"2026-10-v1"}'::jsonb,
  '[{"variantId":"honey-red-250","grind":"En grano","quantity":1}]'::jsonb, repeat('f', 64), 'WOMPI', 300000) is not null as created;
select public.settle_wompi_transaction(encode(sha256('evt-dec'),'hex'), 'CDT-WOMPI-0004', 'tx-dec', 'DECLINED', (26000+12000)::bigint*100, 'COP') as declined;
select status, cancelled_reason from public.orders where reference = 'CDT-WOMPI-0004';
select stock_on_hand, stock_reserved from public.product_variants where id = 'honey-red-250';

-- ---------------------------------------------------------------- catalog admin
select public.admin_configure_product('honey-black', 'Honey Black', 'La expresión más intensa', 'Desc', array['Fruta confitada','Melaza'], 'Edición limitada', false, 7, null) as product_cfg;
select count(*) filter (where product_id = 'honey-black') as honey_black_rows_after_unpublish from public.storefront_catalog_items();
select public.admin_create_variant('lena', '1 kg', 1000, 78000, array['En grano','Espresso · fina'], null) as new_variant;
select public.admin_create_variant('lena', '1 kg', 1000, 78000, array['En grano'], null) like 'lena-1000g-%' as new_variant_suffix;
select id, label, image_url, sort_order, price_confirmed from public.product_variants where product_id = 'lena' order by sort_order;
select action, product_id, variant_id from public.catalog_audit_log order by created_at;

select * from public.admin_store_metrics;
select e.status, e.message, e.is_internal from public.order_events e join public.orders o on o.id = e.order_id where o.reference = 'CDT-WOMPI-0001' order by e.created_at;
reset role;
-- rate limiter
set role service_role;
select public.consume_scoped_limit(repeat('9',64), 2, 3600) a, public.consume_scoped_limit(repeat('9',64), 2, 3600) b, public.consume_scoped_limit(repeat('9',64), 2, 3600) c_false;
select public.prune_store_rate_limits() >= 0 as pruned;
reset role;
-- ---------------------------------------------------------------- packaged images (008)
do $$ begin
  if (select image_url from public.product_variants where id = 'lena-500') = '/assets/pack-lena-500-ground.png'
     and (select bean_image_url from public.product_variants where id = 'lena-500') = '/assets/pack-lena-500-beans.png'
     and (select bean_image_url from public.product_variants where id = 'honey-red-250') = '/assets/pack-honey-red-250-beans.png'
     and (select bean_image_url from public.product_variants where id = 'precision-500') is null
  then raise notice 'ok: variants show packaged images';
  else raise exception 'FAIL packaged images';
  end if;
end $$;
