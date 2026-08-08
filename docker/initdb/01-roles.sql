-- Provision app-level Postgres roles (runs once, only against a fresh/empty data volume).
-- admin_user: bypasses RLS, used only by lib/db-admin.ts for admin-only operations.
-- app_user: normal RLS-scoped role, used by every regular request path.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin_user') THEN
    CREATE ROLE admin_user WITH LOGIN PASSWORD 'admin_user_password' BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password';
  END IF;
END $$;

GRANT CONNECT ON DATABASE ai_knowledge_assistant TO admin_user, app_user;
GRANT USAGE ON SCHEMA public TO admin_user, app_user;
