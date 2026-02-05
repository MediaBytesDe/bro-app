-- Performance Views for Complex Queries
-- Date: 2026-02-05
-- Purpose: Pre-compute complex joins and aggregations for better query performance

-- ==========================================
-- View 1: Projects with task counts
-- ==========================================
CREATE OR REPLACE VIEW projects_with_details AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.description,
  p.icon,
  p.color,
  p.sort_order,
  p.created_at,
  p.updated_at,
  -- Counts (pre-aggregated)
  (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
  (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') as open_task_count,
  (SELECT COUNT(*) FROM categories WHERE project_id = p.id) as category_count
FROM projects p;

-- ==========================================
-- View 2: Customers with statistics
-- ==========================================
CREATE OR REPLACE VIEW customers_with_stats AS
SELECT
  c.*,
  (SELECT COUNT(*) FROM wawi_quotes WHERE customer_id = c.id) as quote_count,
  (SELECT COUNT(*) FROM wawi_quotes WHERE customer_id = c.id AND status = 'accepted') as accepted_quote_count,
  (SELECT COALESCE(SUM(total_amount), 0) FROM wawi_quotes WHERE customer_id = c.id AND status = 'accepted') as total_revenue,
  (SELECT COUNT(*) FROM appointments WHERE customer_id = c.id) as appointment_count,
  (SELECT COUNT(*) FROM documents WHERE customer_id = c.id) as document_count
FROM customers c;

-- ==========================================
-- View 3: Dashboard stats (pre-aggregated)
-- ==========================================
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM customers WHERE status = 'active') as active_customers,
  (SELECT COUNT(*) FROM projects) as total_projects,
  (SELECT COUNT(*) FROM wawi_quotes WHERE status IN ('draft', 'open')) as pending_quotes,
  (SELECT COUNT(*) FROM wawi_quotes WHERE status = 'sent') as sent_quotes,
  (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
  (SELECT COUNT(*) FROM tasks WHERE status != 'done') as open_tasks,
  (SELECT COUNT(*) FROM appointments WHERE start_time >= CURRENT_DATE) as upcoming_appointments;

-- ==========================================
-- Grants - Allow authenticated users to query views
-- ==========================================
GRANT SELECT ON projects_with_details TO authenticated, service_role, anon;
GRANT SELECT ON customers_with_stats TO authenticated, service_role, anon;
GRANT SELECT ON dashboard_stats TO authenticated, service_role, anon;

-- ==========================================
-- Comments for documentation
-- ==========================================
COMMENT ON VIEW projects_with_details IS 'Projects with pre-computed task and category counts. Use this view instead of manual COUNT queries for project lists.';
COMMENT ON VIEW customers_with_stats IS 'Customers with aggregated statistics (quote count, revenue, appointments, documents). Use for customer list pages.';
COMMENT ON VIEW dashboard_stats IS 'Pre-aggregated dashboard statistics. Use for dashboard overview counts.';
