-- =====================================================================
-- 007 · Privilegios mínimos para anon y authenticated
--
-- Supabase concede por defecto todos los privilegios sobre las tablas de
-- public a anon y authenticated, y RLS es la única barrera. La tienda no
-- necesita que esos roles escriban directo en ninguna tabla: los cambios pasan
-- por funciones que solo ejecuta service_role. Además, TRUNCATE no está
-- sujeto a RLS. Esta migración deja solo lo que la tienda usa:
--   - anon: ejecutar storefront_catalog_items() y storefront_shipping_zones().
--   - authenticated: además, leer (SELECT) las tablas que las políticas de
--     administrador permiten ver.
-- Los objetos que se creen después en public ya no quedan expuestos por
-- defecto: cada migración debe conceder explícitamente lo que necesite.
-- =====================================================================

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- EXECUTE para PUBLIC es un privilegio global de PostgreSQL: solo se retira
-- sin "in schema" (aplica a las funciones que cree postgres en adelante).
alter default privileges for role postgres
  revoke execute on functions from public;
