-- Fix view permissions to include service_role and anon
-- Date: 2026-02-05

GRANT SELECT ON projects_with_details TO authenticated, service_role, anon;
GRANT SELECT ON customers_with_stats TO authenticated, service_role, anon;
GRANT SELECT ON dashboard_stats TO authenticated, service_role, anon;
