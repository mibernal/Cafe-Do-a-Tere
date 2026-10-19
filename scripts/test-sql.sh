#!/usr/bin/env bash
# Pruebas de la base de datos sobre un PostgreSQL vacío (local o CI):
# entorno de Supabase simulado + todas las migraciones + tests/sql.
# Usa las variables de libpq: PGHOST, PGPORT, PGUSER, PGPASSWORD.
set -euo pipefail
cd "$(dirname "$0")/.."

db="${TEST_DATABASE:-cafe_test}"
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists ${db} with (force)" -c "create database ${db}"
PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f tests/sql/00_supabase_stub.sql
for migration in supabase/migrations/*.sql; do
  echo "→ ${migration}"
  PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$migration"
done

if ! psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/sql/functions.test.sql >"$log" 2>&1; then
  cat "$log"
  exit 1
fi
if grep -q "FAIL" "$log"; then
  cat "$log"
  exit 1
fi
checks="$(grep -c "ok:" "$log" || true)"
if [ "$checks" -lt 20 ]; then
  cat "$log"
  echo "Se esperaban al menos 20 verificaciones y hubo ${checks}."
  exit 1
fi
echo "✓ ${checks} verificaciones de la base de datos correctas"
