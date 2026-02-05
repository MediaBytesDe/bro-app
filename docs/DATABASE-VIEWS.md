# Database Performance Views

## Overview

Performance views pre-compute complex joins and aggregations to improve query performance. These views act as virtual tables that simplify complex queries and enable better database-level optimization.

## Available Views

### 1. projects_with_details

Projects with pre-computed task and category counts.

**Purpose:** Eliminates the need for multiple subqueries when fetching project data with related counts.

**Usage:**
```typescript
const { data } = await supabase
  .from('projects_with_details')
  .select('*')
  .order('name');
```

**Fields:**
- All project fields (id, name, slug, description, icon, color, sort_order, created_at, updated_at)
- Counts: task_count, open_task_count, category_count

**Performance Benefits:**
- Pre-computed counts avoid expensive COUNT queries for each project
- Single query for project list with statistics
- Database-level query optimization for subqueries

### 2. customers_with_stats

Customers with aggregated statistics.

**Purpose:** Provides customer data with business metrics without manual aggregation queries.

**Usage:**
```typescript
const { data } = await supabase
  .from('customers_with_stats')
  .select('*')
  .eq('status', 'active')
  .order('total_revenue', { ascending: false });
```

**Additional Fields:**
- quote_count: Total quotes for customer (all statuses)
- accepted_quote_count: Count of accepted quotes
- total_revenue: Sum of accepted quote amounts
- appointment_count: Total appointments for customer
- document_count: Total documents for customer

**Performance Benefits:**
- Pre-computed aggregations across multiple tables
- Enables efficient sorting by revenue or quote count
- Single query for customer list with comprehensive statistics

### 3. dashboard_stats

Pre-aggregated dashboard statistics (single row).

**Purpose:** Fast dashboard metrics without multiple COUNT queries.

**Usage:**
```typescript
const { data: stats } = await supabase
  .from('dashboard_stats')
  .select('*')
  .single();
```

**Fields:**
- active_customers: Count of active customers (status = 'active')
- total_projects: Total count of all projects
- pending_quotes: Count of draft/open quotes
- sent_quotes: Count of sent quotes awaiting response
- new_leads: Count of new leads (status = 'new')
- open_tasks: Count of incomplete tasks (status != 'done')
- upcoming_appointments: Count of future appointments (start_time >= today)

**Performance Benefits:**
- Single query for all dashboard metrics
- Database-level aggregation optimization
- Reduced load on application server

## Best Practices

### When to Use Views

- Fetching projects with task and category counts
- Displaying customer lists with aggregated statistics (revenue, quote counts)
- Dashboard metrics and overview pages
- Reports that require pre-computed aggregations

### When NOT to Use Views

- Single-table queries without joins
- Insert/update/delete operations (views are read-only)
- Real-time data that changes extremely frequently
- Queries that need specific column subsets (views fetch all columns)

## Performance Considerations

### View Execution

Views are **not materialized** - they are re-computed on each query. This means:
- Always up-to-date data
- No refresh/maintenance needed
- Query time depends on underlying table sizes

### Optimization Tips

1. **Add WHERE clauses** to filter data:
   ```typescript
   .from('customers_with_stats')
   .eq('status', 'active')  // Filters are pushed down to underlying query
   ```

2. **Select specific columns** when possible:
   ```typescript
   .select('id, company_name, first_name, last_name, total_revenue, quote_count')
   ```

3. **Use indexes** on underlying tables for best performance:
   - Foreign keys are already indexed (customer_id, project_id, etc.)
   - Status columns are indexed on most tables (customers.status, tasks.status, etc.)

4. **Monitor performance** with EXPLAIN ANALYZE:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM customers_with_stats WHERE status = 'active' ORDER BY total_revenue DESC LIMIT 10;
   ```

## Migration to Materialized Views

For even better performance with large datasets, consider converting to MATERIALIZED VIEWS:

```sql
-- Example: Materialized view (cached results)
CREATE MATERIALIZED VIEW customers_with_stats_mv AS
SELECT * FROM customers_with_stats;

-- Refresh strategy (manual or scheduled)
REFRESH MATERIALIZED VIEW customers_with_stats_mv;
```

**Trade-offs:**
- Much faster queries (data is pre-computed and cached)
- Data may be slightly stale (needs periodic refresh)
- Requires refresh strategy and maintenance

## Security

All views inherit Row Level Security (RLS) policies from underlying tables:
- Users can only see rows they have permission to access
- Views are granted SELECT permission to `authenticated` role
- No additional RLS configuration needed

## Troubleshooting

### View doesn't return expected data

1. Check RLS policies on underlying tables
2. Verify user authentication
3. Test underlying query directly

### Performance issues

1. Check indexes on underlying tables
2. Use EXPLAIN ANALYZE to identify bottlenecks
3. Consider filtering data with WHERE clauses
4. Consider materialized views for very large datasets

## Migration Information

**File:** `supabase/migrations/20260205_create_performance_views.sql`

**Applied:** 2026-02-05

**Rollback:** To remove views:
```sql
DROP VIEW IF EXISTS projects_with_details;
DROP VIEW IF EXISTS customers_with_stats;
DROP VIEW IF EXISTS dashboard_stats;
```
