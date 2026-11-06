#!/bin/bash
# Runs migrations + workflow tests on a throwaway local Postgres (needs postgres installed).
set -e; cd "$(dirname "$0")"
su postgres -c "psql -q -c 'drop database if exists xt' -c 'create database xt'" 2>/dev/null
for f in supabase/tests/00_shim.sql supabase/migrations/*.sql supabase/tests/10_workflow.sql supabase/tests/30_loops.sql supabase/tests/40_security.sql; do
  su postgres -c "psql -d xt -At -F ' | ' -f $PWD/$f" 2>&1 | grep -E "^(T[0-9]|S[0-9]|psql|ERROR)" || true
done
