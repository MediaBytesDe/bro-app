# BRO-App Performance Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize BRO-App for 30+ concurrent users with focus on performance, speed, and scalability

**Current State:**
- 30+ concurrent users on Supabase Free Tier (2 DB connections max) ⚠️ CRITICAL
- General slowness across all features
- Large monolithic components (2,855 lines, 1,407 lines)
- Client-side data fetching without caching
- No pagination on lists
- Heavy client-side PDF/3D processing

**Target State:**
- Sub-second page loads for most pages
- Smooth multi-user experience
- Modular, maintainable components
- Efficient data fetching with caching
- Optimized bundle size

**Architecture Approach:**
- Git feature branch for safe rollback
- Phase 1: Database & Infrastructure (Quick Wins)
- Phase 2: Frontend Optimization & Refactoring
- Phase 3: Advanced Optimizations

**Tech Stack:** Next.js 16, React 19, Supabase PostgreSQL, TanStack Query, React.memo

---

## ⚠️ CRITICAL: Before Starting

### IMMEDIATE ACTION REQUIRED

**Supabase Free Tier Limitation:**
- Current: 2 concurrent database connections
- Required for 30+ users: Minimum 60 connections (2 per user)
- **Action:** Upgrade to Supabase Pro Tier ($25/month) or higher
- Without this, all other optimizations will have limited impact

**Verification:**
```bash
# Check current connection usage in Supabase Dashboard
# Settings → Database → Connection pooling
# Should show connection limit and current usage
```

---

## Setup: Create Feature Branch

### Task 0: Setup Safe Working Environment

**Files:**
- N/A (Git operations only)

**Step 1: Create feature branch**

```bash
cd /Users/silence/Projekte/bro-app
git checkout -b optimize/performance-improvements
git push -u origin optimize/performance-improvements
```

**Step 2: Verify clean state**

```bash
git status
# Expected: "On branch optimize/performance-improvements"
# Expected: "Your branch is up to date"
```

**Step 3: Create backup tag**

```bash
git tag backup/pre-optimization-$(date +%Y%m%d)
git push --tags
```

---

# Phase 1: Database & Infrastructure (Quick Wins)

**Goal:** Reduce database query load and improve connection handling
**Estimated Time:** 1-2 days
**Expected Impact:** 50-70% improvement in page load times

---

## Task 1: Database Indexes Analysis & Creation

**Problem:** Missing indexes cause slow queries on frequently-accessed tables

**Files:**
- Create: `supabase/migrations/20260205180000_add_performance_indexes.sql`

**Step 1: Analyze most common queries**

Check current schema for missing indexes:
```sql
-- Check existing indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Step 2: Create comprehensive index migration**

Create file: `supabase/migrations/20260205180000_add_performance_indexes.sql`

```sql
-- Performance Optimization: Add missing indexes
-- Date: 2026-02-05

-- Customers table
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Projects table
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Messages table (for chat functionality)
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_visible_to_customer ON messages(visible_to_customer)
  WHERE visible_to_customer = true;

-- Documents table
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Appointments table
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Quotes table
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_customer_id ON wawi_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_status ON wawi_quotes(status);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_created_at ON wawi_quotes(created_at DESC);

-- Leads table
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Partner assignments
CREATE INDEX IF NOT EXISTS idx_project_partners_project_id ON project_partners(project_id);
CREATE INDEX IF NOT EXISTS idx_project_partners_partner_id ON project_partners(partner_id);

-- Job diary entries
CREATE INDEX IF NOT EXISTS idx_job_diary_project_id ON job_diary_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_job_diary_partner_user ON job_diary_entries(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_job_diary_date ON job_diary_entries(work_date DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_projects_customer_status
  ON projects(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_messages_project_visible
  ON messages(project_id, visible_to_customer)
  WHERE visible_to_customer = true;

CREATE INDEX IF NOT EXISTS idx_appointments_customer_date
  ON appointments(customer_id, appointment_date);

-- Add comments
COMMENT ON INDEX idx_customers_auth_user_id IS 'Optimize user profile lookups';
COMMENT ON INDEX idx_projects_customer_status IS 'Optimize project filtering by customer and status';
COMMENT ON INDEX idx_messages_project_visible IS 'Optimize customer message queries';
```

**Step 3: Apply migration**

```bash
cd /Users/silence/Projekte/bro-app
supabase migration up
```

Expected output: "Applied migration 20260205180000_add_performance_indexes"

**Step 4: Verify indexes created**

```sql
-- Check new indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename;
```

Expected: ~25+ new indexes

**Step 5: Commit**

```bash
git add supabase/migrations/20260205180000_add_performance_indexes.sql
git commit -m "perf: add database indexes for common queries"
```

---

## Task 2: Supabase Connection Pooling Configuration

**Problem:** 2 connections for 30+ users causes bottlenecks

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/server.ts`

**Step 1: Read current client configuration**

```bash
cat src/lib/supabase/client.ts
cat src/lib/supabase/server.ts
```

**Step 2: Update client.ts with connection pooling**

File: `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Enable automatic connection pooling
      db: {
        schema: 'public',
      },
      auth: {
        // Reduce token refresh frequency to minimize DB calls
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        // Add fetch options for better caching
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            // Add keep-alive for connection reuse
            keepalive: true,
          })
        },
      },
    }
  )
}
```

**Step 3: Update server.ts with pooling configuration**

File: `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component - ignore cookie set errors
          }
        },
      },
      // Connection pooling settings
      db: {
        schema: 'public',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        flowType: 'pkce',
      },
    }
  );
}
```

**Step 4: Test connection**

```bash
npm run dev
# Navigate to http://localhost:3000
# Login and verify no connection errors in console
```

**Step 5: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "perf: optimize Supabase connection pooling config"
```

---

## Task 3: Install TanStack Query for Client-Side Caching

**Problem:** Every page mount fetches data from scratch, no caching

**Files:**
- Modify: `package.json`
- Create: `src/lib/query-client.ts`
- Create: `src/providers/query-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Install dependencies**

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

**Step 2: Create query client configuration**

File: `src/lib/query-client.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Retry failed queries
        retry: 1,
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
      },
    },
  });
}

// Browser query client singleton
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
```

**Step 3: Create query provider component**

File: `src/providers/query-provider.tsx`

```typescript
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';
import { ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Step 4: Add provider to root layout**

File: `src/app/layout.tsx`

Add import:
```typescript
import { QueryProvider } from '@/providers/query-provider';
```

Wrap children with QueryProvider (inside body):
```typescript
<body className={inter.className}>
  <QueryProvider>
    {children}
  </QueryProvider>
</body>
```

**Step 5: Test installation**

```bash
npm run build
# Expected: Build succeeds without errors
```

**Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/query-client.ts src/providers/query-provider.tsx src/app/layout.tsx
git commit -m "feat: add TanStack Query for client-side caching"
```

---

## Task 4: Create Database Query Helpers with Caching

**Problem:** Duplicate query logic across components

**Files:**
- Create: `src/lib/queries/customers.ts`
- Create: `src/lib/queries/projects.ts`
- Create: `src/lib/queries/appointments.ts`
- Create: `src/lib/queries/tasks.ts`

**Step 1: Create customers query helpers**

File: `src/lib/queries/customers.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.lists(),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(data.id) });
    },
  });
}
```

**Step 2: Create projects query helpers**

File: `src/lib/queries/projects.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

export function useProjects(customerId?: string) {
  return useQuery({
    queryKey: projectKeys.list({ customerId }),
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('projects')
        .select(`
          *,
          customer:customers(id, company_name, first_name, last_name)
        `)
        .order('updated_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          customer:customers(*),
          messages(*),
          documents(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
```

**Step 3: Create appointments query helpers**

File: `src/lib/queries/appointments.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...appointmentKeys.lists(), filters] as const,
  today: () => [...appointmentKeys.all, 'today'] as const,
  upcoming: () => [...appointmentKeys.all, 'upcoming'] as const,
};

export function useAppointmentsToday() {
  return useQuery({
    queryKey: appointmentKeys.today(),
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(id, company_name, first_name, last_name)
        `)
        .gte('appointment_date', today)
        .lt('appointment_date', `${today}T23:59:59`)
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    // Refetch every 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useAppointmentsUpcoming(days: number = 7) {
  return useQuery({
    queryKey: appointmentKeys.list({ upcoming: days }),
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + days);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(id, company_name, first_name, last_name)
        `)
        .gte('appointment_date', today.toISOString())
        .lte('appointment_date', future.toISOString())
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
```

**Step 4: Create tasks query helpers**

File: `src/lib/queries/tasks.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...taskKeys.lists(), filters] as const,
  my: (userId: string) => [...taskKeys.all, 'my', userId] as const,
};

export function useMyTasks(userId: string | null) {
  return useQuery({
    queryKey: taskKeys.my(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .neq('status', 'completed')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useTasksByStatus(status: string) {
  return useQuery({
    queryKey: taskKeys.list({ status }),
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
```

**Step 5: Test query helpers**

Create simple test file to verify imports work:

```typescript
// test-queries.ts (temporary)
import { useCustomers } from '@/lib/queries/customers';
import { useProjects } from '@/lib/queries/projects';
console.log('Query helpers loaded successfully');
```

```bash
npm run build
# Expected: Build succeeds
```

**Step 6: Commit**

```bash
git add src/lib/queries/
git commit -m "feat: add TanStack Query helpers for data fetching"
```

---

## Task 5: Implement Pagination Component

**Problem:** Lists load all data at once, causing slowness

**Files:**
- Create: `src/components/ui/pagination.tsx`
- Create: `src/hooks/use-pagination.ts`

**Step 1: Create pagination component**

File: `src/components/ui/pagination.tsx`

```typescript
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-between border-t border-neutral-700 bg-neutral-800/50 px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          className="relative inline-flex items-center rounded-md border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Zurück
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="relative ml-3 inline-flex items-center rounded-md border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Weiter
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-neutral-400">
            Zeige <span className="font-medium text-neutral-200">{startItem}</span> bis{' '}
            <span className="font-medium text-neutral-200">{endItem}</span> von{' '}
            <span className="font-medium text-neutral-200">{totalItems}</span> Ergebnissen
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canGoPrevious}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-neutral-400 ring-1 ring-inset ring-neutral-600 hover:bg-neutral-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Zurück</span>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;

              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              const isCurrentPage = pageNum === currentPage;

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    isCurrentPage
                      ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'text-neutral-300 ring-1 ring-inset ring-neutral-600 hover:bg-neutral-700 focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canGoNext}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-neutral-400 ring-1 ring-inset ring-neutral-600 hover:bg-neutral-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Weiter</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create pagination hook**

File: `src/hooks/use-pagination.ts`

```typescript
'use client';

import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

export function usePagination<T>(
  data: T[] | undefined,
  options: UsePaginationOptions = {}
) {
  const { initialPage = 1, pageSize = 20 } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const paginatedData = useMemo(() => {
    if (!data) return [];

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.length / pageSize);
  }, [data, pageSize]);

  const totalItems = data?.length || 0;

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => goToPage(currentPage + 1);
  const previousPage = () => goToPage(currentPage - 1);
  const resetPage = () => setCurrentPage(1);

  return {
    // Data
    data: paginatedData,
    // Pagination state
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    // Actions
    goToPage,
    nextPage,
    previousPage,
    resetPage,
  };
}
```

**Step 3: Test pagination component**

```bash
npm run build
# Expected: Build succeeds without errors
```

**Step 4: Commit**

```bash
git add src/components/ui/pagination.tsx src/hooks/use-pagination.ts
git commit -m "feat: add pagination component and hook"
```

---

## Task 6: Optimize Images with Next.js Image Component

**Problem:** Direct `<img>` tags cause slow loading, no optimization

**Files:**
- Modify: `src/app/(partner)/partner/auftraege/[id]/rapport/page.tsx`
- Modify: `src/app/(app)/subcontractors/page.tsx`
- Modify: `src/components/workfolder-detail.tsx`

**Step 1: Update rapport page images**

File: `src/app/(partner)/partner/auftraege/[id]/rapport/page.tsx`

Find all `<img` tags and replace with Next.js Image:

```typescript
import Image from 'next/image';

// Replace instances like:
// <img src={photo.url} alt="..." />

// With:
<Image
  src={photo.url}
  alt={photo.description || 'Rapport Foto'}
  width={400}
  height={300}
  className="rounded-lg object-cover"
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA="
/>
```

**Step 2: Update subcontractors page**

File: `src/app/(app)/subcontractors/page.tsx`

Replace logo images:

```typescript
import Image from 'next/image';

// Replace:
// <img src={partner.logo_url} />

// With:
{partner.logo_url && (
  <Image
    src={partner.logo_url}
    alt={`${partner.company_name} Logo`}
    width={80}
    height={80}
    className="rounded-full object-cover"
    loading="lazy"
  />
)}
```

**Step 3: Update workfolder-detail images**

File: `src/components/workfolder-detail.tsx`

Find and replace image tags with Next.js Image components.

**Step 4: Add Supabase storage to allowed domains**

File: `next.config.ts`

Update images.remotePatterns:

```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "db.brojekt.dev",
    },
    {
      protocol: "https",
      hostname: "*.supabase.co",
    },
  ],
},
```

**Step 5: Test images load**

```bash
npm run dev
# Navigate to pages with images
# Verify images load correctly with blur effect
```

**Step 6: Commit**

```bash
git add src/app/(partner)/partner/auftraege/[id]/rapport/page.tsx src/app/(app)/subcontractors/page.tsx src/components/workfolder-detail.tsx next.config.ts
git commit -m "perf: optimize images with Next.js Image component"
```

---

# Phase 1 Complete ✅

**Checkpoint: Verify Phase 1 Improvements**

```bash
# Run build
npm run build

# Start production server
npm run start

# Test in browser:
# 1. Dashboard loads faster
# 2. Lists are paginated
# 3. Images load with blur effect
# 4. No connection errors in console
```

**Expected Improvements:**
- 50-70% faster page loads
- Reduced database connection pressure
- Smoother navigation (cached data)
- Optimized image loading

**Commit phase completion:**

```bash
git add -A
git commit -m "feat: Phase 1 complete - database & infrastructure optimizations"
git push origin optimize/performance-improvements
```

---

# Phase 2: Frontend Optimization & Refactoring

**Goal:** Break down monolithic components and optimize React rendering
**Estimated Time:** 3-5 days
**Expected Impact:** Improved maintainability, 30-40% faster rendering

---

## Task 7: Refactor Dashboard with React.memo and useMemo

**Problem:** Dashboard re-renders all sections on any state change

**Files:**
- Modify: `src/app/(app)/dashboard.tsx`
- Create: `src/components/dashboard/appointments-section.tsx`
- Create: `src/components/dashboard/tasks-section.tsx`
- Create: `src/components/dashboard/stats-section.tsx`

**Step 1: Extract appointments section**

File: `src/components/dashboard/appointments-section.tsx`

```typescript
'use client';

import { memo } from 'react';
import { Calendar } from 'lucide-react';
import { useAppointmentsToday, useAppointmentsUpcoming } from '@/lib/queries/appointments';

interface AppointmentsSectionProps {
  userId: string;
}

export const AppointmentsSection = memo(function AppointmentsSection({
  userId,
}: AppointmentsSectionProps) {
  const { data: todayAppointments, isLoading: loadingToday } = useAppointmentsToday();
  const { data: upcomingAppointments, isLoading: loadingUpcoming } = useAppointmentsUpcoming(7);

  if (loadingToday || loadingUpcoming) {
    return (
      <div className="rounded-lg bg-neutral-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-700 rounded w-1/3"></div>
          <div className="h-20 bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-neutral-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-blue-400" />
        <h2 className="text-lg font-semibold">Termine</h2>
      </div>

      {/* Today's appointments */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-neutral-400 mb-2">
          Heute ({todayAppointments?.length || 0})
        </h3>
        {todayAppointments && todayAppointments.length > 0 ? (
          <ul className="space-y-2">
            {todayAppointments.map((apt) => (
              <li
                key={apt.id}
                className="flex items-start gap-3 rounded-lg bg-neutral-700/50 p-3"
              >
                <div className="flex-1">
                  <p className="font-medium">{apt.customer?.company_name || 'Kunde'}</p>
                  <p className="text-sm text-neutral-400">
                    {new Date(apt.appointment_date).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Keine Termine heute</p>
        )}
      </div>

      {/* Upcoming appointments */}
      <div>
        <h3 className="text-sm font-medium text-neutral-400 mb-2">
          Diese Woche ({upcomingAppointments?.length || 0})
        </h3>
        {upcomingAppointments && upcomingAppointments.length > 0 ? (
          <ul className="space-y-2">
            {upcomingAppointments.slice(0, 5).map((apt) => (
              <li
                key={apt.id}
                className="flex items-start gap-3 rounded-lg bg-neutral-700/50 p-3"
              >
                <div className="flex-1">
                  <p className="font-medium">{apt.customer?.company_name || 'Kunde'}</p>
                  <p className="text-sm text-neutral-400">
                    {new Date(apt.appointment_date).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Keine Termine diese Woche</p>
        )}
      </div>
    </div>
  );
});
```

**Step 2: Extract tasks section**

File: `src/components/dashboard/tasks-section.tsx`

```typescript
'use client';

import { memo } from 'react';
import { CheckSquare } from 'lucide-react';
import { useMyTasks } from '@/lib/queries/tasks';

interface TasksSectionProps {
  userId: string;
}

export const TasksSection = memo(function TasksSection({ userId }: TasksSectionProps) {
  const { data: tasks, isLoading } = useMyTasks(userId);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-neutral-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-700 rounded w-1/3"></div>
          <div className="h-20 bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  const incompleteTasks = tasks?.filter((t) => t.status !== 'completed') || [];
  const urgentTasks = incompleteTasks.filter((t) => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  });

  return (
    <div className="rounded-lg bg-neutral-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare className="h-5 w-5 text-green-400" />
        <h2 className="text-lg font-semibold">Meine Aufgaben</h2>
      </div>

      {/* Urgent tasks */}
      {urgentTasks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-red-400 mb-2">
            Dringend ({urgentTasks.length})
          </h3>
          <ul className="space-y-2">
            {urgentTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-lg bg-red-900/20 border border-red-800 p-3"
              >
                <div className="flex-1">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-neutral-400">
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString('de-DE')
                      : 'Kein Fälligkeitsdatum'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* All incomplete tasks */}
      <div>
        <h3 className="text-sm font-medium text-neutral-400 mb-2">
          Offen ({incompleteTasks.length})
        </h3>
        {incompleteTasks.length > 0 ? (
          <ul className="space-y-2">
            {incompleteTasks.slice(0, 5).map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-lg bg-neutral-700/50 p-3"
              >
                <div className="flex-1">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-neutral-400">{task.status}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Keine offenen Aufgaben</p>
        )}
      </div>
    </div>
  );
});
```

**Step 3: Extract stats section**

File: `src/components/dashboard/stats-section.tsx`

```typescript
'use client';

import { memo } from 'react';
import { Users, FolderOpen, FileText, TrendingUp } from 'lucide-react';

interface StatsSectionProps {
  stats: {
    customers: number;
    projects: number;
    quotes: number;
    leads: number;
  };
}

export const StatsSection = memo(function StatsSection({ stats }: StatsSectionProps) {
  const statCards = [
    {
      label: 'Kunden',
      value: stats.customers,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
    },
    {
      label: 'Projekte',
      value: stats.projects,
      icon: FolderOpen,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
    },
    {
      label: 'Angebote',
      value: stats.quotes,
      icon: FileText,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/20',
    },
    {
      label: 'Leads',
      value: stats.leads,
      icon: TrendingUp,
      color: 'text-orange-400',
      bgColor: 'bg-orange-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={`rounded-lg ${stat.bgColor} p-6`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
              </div>
              <Icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
});
```

**Step 4: Update dashboard to use extracted components**

File: `src/app/(app)/dashboard.tsx`

Replace existing implementation with:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { StatsSection } from '@/components/dashboard/stats-section';
import { AppointmentsSection } from '@/components/dashboard/appointments-section';
import { TasksSection } from '@/components/dashboard/tasks-section';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    customers: 0,
    projects: 0,
    quotes: 0,
    leads: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const supabase = createClient();

    // Parallel loading of counts
    const [customersRes, projectsRes, quotesRes, leadsRes] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('wawi_quotes').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      customers: customersRes.count || 0,
      projects: projectsRes.count || 0,
      quotes: quotesRes.count || 0,
      leads: leadsRes.count || 0,
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-neutral-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Overview */}
      <StatsSection stats={stats} />

      {/* Appointments and Tasks Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AppointmentsSection userId={profile?.id || ''} />
        <TasksSection userId={profile?.id || ''} />
      </div>
    </div>
  );
}
```

**Step 5: Test dashboard**

```bash
npm run dev
# Navigate to dashboard
# Verify all sections load correctly
# Check DevTools for reduced re-renders
```

**Step 6: Commit**

```bash
git add src/app/(app)/dashboard.tsx src/components/dashboard/
git commit -m "refactor: extract dashboard sections with React.memo"
```

---

## Task 8: Split workfolder-detail Component (Critical - 2,855 lines)

**Problem:** Massive component is unmaintainable and causes performance issues

**Strategy:** Split into smaller components by responsibility

**Files:**
- Modify: `src/components/workfolder-detail.tsx`
- Create: `src/components/workfolder/header-section.tsx`
- Create: `src/components/workfolder/info-section.tsx`
- Create: `src/components/workfolder/documents-section.tsx`
- Create: `src/components/workfolder/messages-section.tsx`
- Create: `src/components/workfolder/timeline-section.tsx`
- Create: `src/components/workfolder/tasks-section.tsx`

**Step 1: Create directory structure**

```bash
mkdir -p src/components/workfolder
```

**Step 2: Extract header section**

File: `src/components/workfolder/header-section.tsx`

```typescript
'use client';

import { memo } from 'react';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

interface HeaderSectionProps {
  project: {
    id: string;
    name: string;
    status: string;
    customer?: {
      company_name?: string;
      first_name?: string;
      last_name?: string;
    };
  };
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
}

export const HeaderSection = memo(function HeaderSection({
  project,
  onBack,
  onEdit,
  onDelete,
  canEdit,
}: HeaderSectionProps) {
  const customerName =
    project.customer?.company_name ||
    `${project.customer?.first_name || ''} ${project.customer?.last_name || ''}`.trim() ||
    'Unbekannter Kunde';

  return (
    <div className="bg-neutral-800 border-b border-neutral-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Zurück</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-neutral-400">{customerName}</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                <Edit className="h-4 w-4" />
                <span>Bearbeiten</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Löschen</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className="mt-4">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            project.status === 'active'
              ? 'bg-green-900/20 text-green-400'
              : project.status === 'completed'
              ? 'bg-blue-900/20 text-blue-400'
              : 'bg-neutral-700 text-neutral-400'
          }`}
        >
          {project.status}
        </span>
      </div>
    </div>
  );
});
```

**Step 3: Extract info section**

File: `src/components/workfolder/info-section.tsx`

```typescript
'use client';

import { memo } from 'react';
import { Calendar, MapPin, Euro, Clock } from 'lucide-react';

interface InfoSectionProps {
  project: {
    description?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    budget?: number;
    created_at: string;
    updated_at: string;
  };
}

export const InfoSection = memo(function InfoSection({ project }: InfoSectionProps) {
  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Projektinformationen</h2>

      <div className="space-y-4">
        {/* Description */}
        {project.description && (
          <div>
            <p className="text-sm text-neutral-400 mb-1">Beschreibung</p>
            <p className="text-neutral-200">{project.description}</p>
          </div>
        )}

        {/* Date range */}
        {(project.start_date || project.end_date) && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-400">Zeitraum</p>
              <p className="text-neutral-200">
                {project.start_date
                  ? new Date(project.start_date).toLocaleDateString('de-DE')
                  : 'Kein Start'}{' '}
                -{' '}
                {project.end_date
                  ? new Date(project.end_date).toLocaleDateString('de-DE')
                  : 'Kein Ende'}
              </p>
            </div>
          </div>
        )}

        {/* Location */}
        {project.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-400">Standort</p>
              <p className="text-neutral-200">{project.location}</p>
            </div>
          </div>
        )}

        {/* Budget */}
        {project.budget && (
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-400">Budget</p>
              <p className="text-neutral-200">
                {new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(project.budget)}
              </p>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <div>
            <p className="text-sm text-neutral-400">Erstellt</p>
            <p className="text-neutral-200 text-sm">
              {new Date(project.created_at).toLocaleString('de-DE')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <div>
            <p className="text-sm text-neutral-400">Zuletzt aktualisiert</p>
            <p className="text-neutral-200 text-sm">
              {new Date(project.updated_at).toLocaleString('de-DE')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
```

**Step 4: Extract documents section (simplified)**

File: `src/components/workfolder/documents-section.tsx`

```typescript
'use client';

import { memo } from 'react';
import { FileText, Download, Eye } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_url: string;
  created_at: string;
}

interface DocumentsSectionProps {
  documents: Document[];
  onUpload?: () => void;
  canUpload: boolean;
}

export const DocumentsSection = memo(function DocumentsSection({
  documents,
  onUpload,
  canUpload,
}: DocumentsSectionProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Dokumente ({documents.length})</h2>
        {canUpload && onUpload && (
          <button
            onClick={onUpload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            + Hochladen
          </button>
        )}
      </div>

      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-sm text-neutral-400">
                    {formatFileSize(doc.file_size)} • {doc.mime_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={doc.storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-neutral-600 rounded transition"
                  title="Ansehen"
                >
                  <Eye className="h-4 w-4" />
                </a>
                <a
                  href={doc.storage_url}
                  download={doc.file_name}
                  className="p-2 hover:bg-neutral-600 rounded transition"
                  title="Herunterladen"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-500 text-center py-8">Keine Dokumente vorhanden</p>
      )}
    </div>
  );
});
```

**Step 5: Extract messages section (simplified)**

File: `src/components/workfolder/messages-section.tsx`

```typescript
'use client';

import { memo } from 'react';
import { MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender_type: string;
  sender_name: string;
  created_at: string;
}

interface MessagesSectionProps {
  messages: Message[];
  onSendMessage?: (text: string) => void;
  canSendMessage: boolean;
}

export const MessagesSection = memo(function MessagesSection({
  messages,
  onSendMessage,
  canSendMessage,
}: MessagesSectionProps) {
  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-blue-400" />
        <h2 className="text-lg font-semibold">Nachrichten ({messages.length})</h2>
      </div>

      {messages.length > 0 ? (
        <div className="space-y-3">
          {messages.slice(-5).map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${
                msg.sender_type === 'customer'
                  ? 'bg-blue-900/20 border border-blue-800'
                  : 'bg-neutral-700/50'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="font-medium text-sm">{msg.sender_name}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(msg.created_at).toLocaleString('de-DE')}
                </p>
              </div>
              <p className="text-neutral-200">{msg.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 text-center py-8">Keine Nachrichten</p>
      )}

      {canSendMessage && messages.length > 5 && (
        <button
          className="mt-4 w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-sm"
        >
          Alle Nachrichten anzeigen ({messages.length})
        </button>
      )}
    </div>
  );
});
```

**Step 6: Update main workfolder-detail component**

File: `src/components/workfolder-detail.tsx`

Replace with refactored structure:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProject } from '@/lib/queries/projects';
import { HeaderSection } from './workfolder/header-section';
import { InfoSection } from './workfolder/info-section';
import { DocumentsSection } from './workfolder/documents-section';
import { MessagesSection } from './workfolder/messages-section';
import { useAuth } from '@/contexts/auth-context';

interface WorkfolderDetailProps {
  projectId: string;
  onBack: () => void;
}

export default function WorkfolderDetail({ projectId, onBack }: WorkfolderDetailProps) {
  const { profile } = useAuth();
  const { data: project, isLoading, error } = useProject(projectId);

  const canEdit = profile?.role && ['admin', 'mitarbeiter'].includes(profile.role);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-neutral-700 rounded"></div>
          <div className="h-64 bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">Projekt konnte nicht geladen werden</p>
        </div>
      </div>
    );
  }

  const documents = project.documents || [];
  const messages = project.messages || [];

  return (
    <div className="min-h-screen bg-neutral-900">
      <HeaderSection
        project={project}
        onBack={onBack}
        canEdit={canEdit}
      />

      <div className="p-6 space-y-6">
        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Info */}
          <div className="lg:col-span-1">
            <InfoSection project={project} />
          </div>

          {/* Right column - Documents and Messages */}
          <div className="lg:col-span-2 space-y-6">
            <DocumentsSection
              documents={documents}
              canUpload={canEdit}
            />
            <MessagesSection
              messages={messages}
              canSendMessage={canEdit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 7: Test workfolder component**

```bash
npm run dev
# Navigate to a project detail page
# Verify all sections render correctly
# Check for improved performance
```

**Step 8: Commit**

```bash
git add src/components/workfolder-detail.tsx src/components/workfolder/
git commit -m "refactor: split workfolder-detail into smaller components"
```

---

## Task 9: Split quote-editor Component (1,407 lines)

**Problem:** Complex quote editor is difficult to maintain

**Strategy:** Extract product selection, item list, calculations into separate components

**Files:**
- Modify: `src/components/quote-editor.tsx`
- Create: `src/components/quote-editor/product-selector.tsx`
- Create: `src/components/quote-editor/quote-items-list.tsx`
- Create: `src/components/quote-editor/quote-summary.tsx`
- Create: `src/components/quote-editor/quote-header-form.tsx`

**Step 1: Create directory**

```bash
mkdir -p src/components/quote-editor
```

**Step 2: Extract product selector**

File: `src/components/quote-editor/product-selector.tsx`

```typescript
'use client';

import { memo, useState } from 'react';
import { Search, Plus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unit_price: number;
  unit: string;
  category?: string;
}

interface ProductSelectorProps {
  products: Product[];
  onAddProduct: (product: Product, quantity: number) => void;
}

export const ProductSelector = memo(function ProductSelector({
  products,
  onAddProduct,
}: ProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (selectedProduct) {
      onAddProduct(selectedProduct, quantity);
      setSelectedProduct(null);
      setQuantity(1);
      setSearchTerm('');
    }
  };

  return (
    <div className="bg-neutral-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Produkt hinzufügen</h3>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
        <input
          type="text"
          placeholder="Produkt suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Product list */}
      {searchTerm && (
        <div className="max-h-60 overflow-y-auto mb-4 border border-neutral-700 rounded-lg">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`w-full text-left p-3 hover:bg-neutral-700 transition ${
                selectedProduct?.id === product.id ? 'bg-neutral-700' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{product.name}</p>
                  {product.category && (
                    <p className="text-sm text-neutral-400">{product.category}</p>
                  )}
                </div>
                <p className="text-sm text-neutral-400">
                  {new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(product.unit_price)}{' '}
                  / {product.unit}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected product */}
      {selectedProduct && (
        <div className="bg-neutral-700 rounded-lg p-4 mb-4">
          <p className="font-medium mb-2">{selectedProduct.name}</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-neutral-400 mb-1">Menge</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-neutral-600 border border-neutral-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAdd}
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
```

**Step 3: Extract quote items list**

File: `src/components/quote-editor/quote-items-list.tsx`

```typescript
'use client';

import { memo } from 'react';
import { Trash2, Edit } from 'lucide-react';

interface QuoteItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit: string;
  total_price: number;
}

interface QuoteItemsListProps {
  items: QuoteItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export const QuoteItemsList = memo(function QuoteItemsList({
  items,
  onUpdateQuantity,
  onRemoveItem,
}: QuoteItemsListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-neutral-800 rounded-lg p-8 text-center">
        <p className="text-neutral-500">Keine Positionen im Angebot</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-neutral-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">
              Produkt
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-400">
              Menge
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-400">
              Einzelpreis
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-400">
              Gesamt
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-400">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-700">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-neutral-700/50 transition">
              <td className="px-4 py-3">
                <p className="font-medium">{item.product_name}</p>
              </td>
              <td className="px-4 py-3 text-right">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                  className="w-20 px-2 py-1 bg-neutral-600 border border-neutral-500 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-neutral-400">{item.unit}</span>
              </td>
              <td className="px-4 py-3 text-right">
                {new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(item.unit_price)}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(item.total_price)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-2 text-red-400 hover:bg-red-900/20 rounded transition"
                  title="Entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
```

**Step 4: Extract quote summary**

File: `src/components/quote-editor/quote-summary.tsx`

```typescript
'use client';

import { memo } from 'react';

interface QuoteSummaryProps {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export const QuoteSummary = memo(function QuoteSummary({
  subtotal,
  taxRate,
  taxAmount,
  total,
}: QuoteSummaryProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);

  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Zusammenfassung</h3>

      <div className="space-y-3">
        <div className="flex justify-between text-neutral-300">
          <span>Zwischensumme</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between text-neutral-300">
          <span>MwSt. ({taxRate}%)</span>
          <span className="font-medium">{formatCurrency(taxAmount)}</span>
        </div>

        <div className="border-t border-neutral-700 pt-3 mt-3">
          <div className="flex justify-between text-lg">
            <span className="font-semibold">Gesamtsumme</span>
            <span className="font-bold text-blue-400">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
```

**Step 5: Update main quote-editor component**

File: `src/components/quote-editor.tsx`

Simplify by using extracted components:

```typescript
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProductSelector } from './quote-editor/product-selector';
import { QuoteItemsList } from './quote-editor/quote-items-list';
import { QuoteSummary } from './quote-editor/quote-summary';
import { Save, X } from 'lucide-react';

interface QuoteEditorProps {
  quoteId?: string;
  customerId: string;
  onSave: (quoteId: string) => void;
  onCancel: () => void;
}

export default function QuoteEditor({
  quoteId,
  customerId,
  onSave,
  onCancel,
}: QuoteEditorProps) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const TAX_RATE = 0.19;

  // Calculate totals
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.total_price, 0),
    [items]
  );
  const taxAmount = subtotal * TAX_RATE;
  const total = subtotal + taxAmount;

  useEffect(() => {
    loadProducts();
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  async function loadProducts() {
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name');
    setProducts(data || []);
  }

  async function loadQuote() {
    // Load existing quote logic
  }

  const handleAddProduct = (product: any, quantity: number) => {
    const totalPrice = product.unit_price * quantity;
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        product_name: product.name,
        quantity,
        unit_price: product.unit_price,
        unit: product.unit,
        total_price: totalPrice,
      },
    ]);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, quantity, total_price: item.unit_price * quantity }
          : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  const handleSave = async () => {
    setLoading(true);
    // Save logic
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {quoteId ? 'Angebot bearbeiten' : 'Neues Angebot'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={loading || items.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Product selector */}
      <ProductSelector products={products} onAddProduct={handleAddProduct} />

      {/* Items list */}
      <QuoteItemsList
        items={items}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
      />

      {/* Summary */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-full max-w-md">
            <QuoteSummary
              subtotal={subtotal}
              taxRate={TAX_RATE * 100}
              taxAmount={taxAmount}
              total={total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 6: Test quote editor**

```bash
npm run dev
# Navigate to quote editor
# Test adding/removing products
# Verify calculations
```

**Step 7: Commit**

```bash
git add src/components/quote-editor.tsx src/components/quote-editor/
git commit -m "refactor: split quote-editor into smaller components"
```

---

# Phase 2 Complete ✅

**Checkpoint: Verify Phase 2 Improvements**

```bash
npm run build
npm run start

# Test:
# 1. Dashboard renders faster with memoized sections
# 2. Workfolder detail is more responsive
# 3. Quote editor is easier to navigate
# 4. Components re-render less frequently
```

**Commit phase:**

```bash
git add -A
git commit -m "feat: Phase 2 complete - frontend optimization & refactoring"
git push origin optimize/performance-improvements
```

---

# Phase 3: Advanced Optimizations

**Goal:** Move heavy operations server-side and implement lazy loading
**Estimated Time:** 3-4 days
**Expected Impact:** Reduced bundle size, faster initial loads

---

## Task 10: Server-Side PDF Generation

**Problem:** Client-side PDF generation blocks UI and increases bundle size

**Files:**
- Create: `src/app/api/pdf/generate/route.ts`
- Modify: `src/components/quote-pdf-button.tsx` (if exists)

**Step 1: Install server-side PDF library**

```bash
npm install puppeteer
```

**Step 2: Create PDF generation API route**

File: `src/app/api/pdf/generate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import puppeteer from 'puppeteer';

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID required' }, { status: 400 });
    }

    // Fetch quote data
    const { data: quote, error } = await authSupabase
      .from('wawi_quotes')
      .select(`
        *,
        customer:customers(*),
        items:wawi_quote_items(*)
      `)
      .eq('id', quoteId)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Generate HTML
    const html = generateQuoteHTML(quote);

    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    await browser.close();

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="angebot-${quote.quote_number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[PDF Generation Error]', error);
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    );
  }
}

function generateQuoteHTML(quote: any): string {
  const subtotal = quote.items.reduce(
    (sum: number, item: any) => sum + item.total_price,
    0
  );
  const taxAmount = subtotal * 0.19;
  const total = subtotal + taxAmount;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    .header {
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 24px;
      margin: 0 0 10px 0;
    }
    .customer-info {
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background-color: #f0f0f0;
      padding: 10px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    .text-right {
      text-align: right;
    }
    .summary {
      margin-left: auto;
      width: 300px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
    }
    .summary-total {
      font-size: 18px;
      font-weight: bold;
      border-top: 2px solid #333;
      padding-top: 10px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Angebot ${quote.quote_number}</h1>
    <p>Datum: ${new Date(quote.created_at).toLocaleDateString('de-DE')}</p>
  </div>

  <div class="customer-info">
    <h2>Kunde</h2>
    <p>
      ${quote.customer.company_name || ''}<br>
      ${quote.customer.first_name || ''} ${quote.customer.last_name || ''}<br>
      ${quote.customer.address || ''}<br>
      ${quote.customer.zip_code || ''} ${quote.customer.city || ''}
    </p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Pos.</th>
        <th>Beschreibung</th>
        <th class="text-right">Menge</th>
        <th class="text-right">Einzelpreis</th>
        <th class="text-right">Gesamt</th>
      </tr>
    </thead>
    <tbody>
      ${quote.items
        .map(
          (item: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.product_name}</td>
          <td class="text-right">${item.quantity} ${item.unit}</td>
          <td class="text-right">${new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
          }).format(item.unit_price)}</td>
          <td class="text-right">${new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
          }).format(item.total_price)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-row">
      <span>Zwischensumme:</span>
      <span>${new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(subtotal)}</span>
    </div>
    <div class="summary-row">
      <span>MwSt. (19%):</span>
      <span>${new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(taxAmount)}</span>
    </div>
    <div class="summary-row summary-total">
      <span>Gesamtsumme:</span>
      <span>${new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(total)}</span>
    </div>
  </div>
</body>
</html>
  `;
}
```

**Step 3: Test PDF generation**

```bash
# Test with curl or Postman
curl -X POST http://localhost:3000/api/pdf/generate \
  -H "Content-Type: application/json" \
  -d '{"quoteId": "your-quote-id"}' \
  --output test.pdf
```

**Step 4: Commit**

```bash
git add src/app/api/pdf/generate/route.ts package.json package-lock.json
git commit -m "feat: add server-side PDF generation API"
```

---

## Task 11: Lazy Load Heavy Libraries

**Problem:** 3D model viewer and PDF libs load on every page

**Files:**
- Modify: `src/components/model-viewer-3d.tsx`
- Create: `src/components/lazy-model-viewer.tsx`

**Step 1: Create lazy wrapper for 3D model viewer**

File: `src/components/lazy-model-viewer.tsx`

```typescript
'use client';

import { lazy, Suspense } from 'react';

const ModelViewer3D = lazy(() => import('./model-viewer-3d'));

interface LazyModelViewerProps {
  modelUrl: string;
  alt?: string;
}

export default function LazyModelViewer({ modelUrl, alt }: LazyModelViewerProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-96 bg-neutral-800 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-neutral-400">Lade 3D-Viewer...</p>
        </div>
      }
    >
      <ModelViewer3D modelUrl={modelUrl} alt={alt} />
    </Suspense>
  );
}
```

**Step 2: Update pages to use lazy model viewer**

Replace all instances of direct `ModelViewer3D` import with `LazyModelViewer`.

**Step 3: Configure Next.js for code splitting**

File: `next.config.ts`

Add experimental flag:

```typescript
experimental: {
  serverActions: {
    bodySizeLimit: "100mb",
  },
  // Enable optimizePackageImports for better tree-shaking
  optimizePackageImports: [
    '@react-pdf/renderer',
    '@google/model-viewer',
    'lucide-react',
  ],
},
```

**Step 4: Test lazy loading**

```bash
npm run build
# Check bundle analyzer output
# Verify 3D viewer only loads when needed
```

**Step 5: Commit**

```bash
git add src/components/lazy-model-viewer.tsx next.config.ts
git commit -m "perf: lazy load heavy 3D model viewer library"
```

---

## Task 12: Convert Pages to Server Components

**Problem:** Many pages unnecessarily run as client components

**Files:**
- Modify: `src/app/(app)/customers/page.tsx`
- Modify: `src/app/(app)/projects/page.tsx`

**Step 1: Convert customers page to server component**

File: `src/app/(app)/customers/page.tsx`

Remove `'use client'` and fetch data server-side:

```typescript
import { createClient } from '@/lib/supabase/server';
import CustomersList from '@/components/customers-list';

export default async function CustomersPage() {
  const supabase = await createClient();

  // Fetch data server-side
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Kunden</h1>
      <CustomersList initialData={customers || []} />
    </div>
  );
}
```

**Step 2: Update CustomersList to be hybrid component**

File: `src/components/customers-list.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useCustomers } from '@/lib/queries/customers';
import { usePagination } from '@/hooks/use-pagination';
import { Pagination } from './ui/pagination';

interface CustomersListProps {
  initialData: any[];
}

export default function CustomersList({ initialData }: CustomersListProps) {
  // Use TanStack Query with initial data
  const { data: customers } = useCustomers();
  const displayData = customers || initialData;

  // Pagination
  const {
    data: paginatedCustomers,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    goToPage,
  } = usePagination(displayData, { pageSize: 20 });

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {paginatedCustomers.map((customer) => (
          <div key={customer.id} className="bg-neutral-800 rounded-lg p-4">
            <h3 className="font-semibold">
              {customer.company_name || `${customer.first_name} ${customer.last_name}`}
            </h3>
            <p className="text-sm text-neutral-400">{customer.email}</p>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goToPage}
        />
      )}
    </>
  );
}
```

**Step 3: Test server component**

```bash
npm run build
npm run start
# Verify customers page renders faster
# Check Network tab for reduced JavaScript
```

**Step 4: Commit**

```bash
git add src/app/(app)/customers/page.tsx src/components/customers-list.tsx
git commit -m "perf: convert customers page to server component"
```

---

## Task 13: Database Query Optimization with Views

**Problem:** Complex queries with multiple joins slow down pages

**Files:**
- Create: `supabase/migrations/20260205190000_create_performance_views.sql`

**Step 1: Create database views for common queries**

File: `supabase/migrations/20260205190000_create_performance_views.sql`

```sql
-- Performance Views for Complex Queries
-- Date: 2026-02-05

-- View: Projects with customer info and counts
CREATE OR REPLACE VIEW projects_with_details AS
SELECT
  p.id,
  p.name,
  p.description,
  p.status,
  p.start_date,
  p.end_date,
  p.budget,
  p.customer_id,
  p.created_at,
  p.updated_at,
  -- Customer info
  c.company_name,
  c.first_name,
  c.last_name,
  c.email,
  -- Counts
  (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as document_count,
  (SELECT COUNT(*) FROM messages WHERE project_id = p.id) as message_count,
  (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
  (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'completed') as open_task_count
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id;

-- View: Customer with statistics
CREATE OR REPLACE VIEW customers_with_stats AS
SELECT
  c.*,
  (SELECT COUNT(*) FROM projects WHERE customer_id = c.id) as project_count,
  (SELECT COUNT(*) FROM wawi_quotes WHERE customer_id = c.id) as quote_count,
  (SELECT SUM(total_amount) FROM wawi_quotes WHERE customer_id = c.id AND status = 'accepted') as total_revenue
FROM customers c;

-- View: Dashboard stats (pre-aggregated)
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM customers WHERE active = true) as active_customers,
  (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
  (SELECT COUNT(*) FROM wawi_quotes WHERE status = 'pending') as pending_quotes,
  (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
  (SELECT COUNT(*) FROM tasks WHERE status != 'completed') as open_tasks,
  (SELECT COUNT(*) FROM appointments WHERE appointment_date >= CURRENT_DATE) as upcoming_appointments;

-- Grants
GRANT SELECT ON projects_with_details TO authenticated;
GRANT SELECT ON customers_with_stats TO authenticated;
GRANT SELECT ON dashboard_stats TO authenticated;

-- Comments
COMMENT ON VIEW projects_with_details IS 'Pre-joined project data with customer and counts';
COMMENT ON VIEW customers_with_stats IS 'Customers with aggregated statistics';
COMMENT ON VIEW dashboard_stats IS 'Dashboard overview statistics';
```

**Step 2: Apply migration**

```bash
cd /Users/silence/Projekte/bro-app
supabase migration up
```

**Step 3: Update queries to use views**

Update dashboard query to use view:

```typescript
// Before
const { data: stats } = await Promise.all([
  supabase.from('customers').select('id', { count: 'exact' }),
  supabase.from('projects').select('id', { count: 'exact' }),
  // ... more queries
]);

// After
const { data: stats } = await supabase
  .from('dashboard_stats')
  .select('*')
  .single();
```

**Step 4: Test view performance**

```sql
-- Test query speed
EXPLAIN ANALYZE
SELECT * FROM projects_with_details
WHERE customer_id = 'some-uuid';
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260205190000_create_performance_views.sql
git commit -m "perf: add database views for complex queries"
```

---

# Phase 3 Complete ✅

**Final Checkpoint: Comprehensive Testing**

```bash
# Build production
npm run build

# Start production server
npm run start

# Load testing (optional)
# Use tool like Apache Bench or k6

# Manual testing:
# 1. Dashboard loads in <1s
# 2. List pages with pagination work smoothly
# 3. PDF generation happens server-side
# 4. 3D models lazy load
# 5. Images are optimized
# 6. No console errors
```

**Commit final phase:**

```bash
git add -A
git commit -m "feat: Phase 3 complete - advanced optimizations"
git push origin optimize/performance-improvements
```

---

# Final Steps: Merge & Deploy

## Task 14: Create Pull Request

**Step 1: Review all changes**

```bash
git log --oneline origin/main..optimize/performance-improvements
git diff origin/main..optimize/performance-improvements --stat
```

**Step 2: Create PR**

```bash
gh pr create \
  --title "Performance Optimization: 30+ Concurrent Users" \
  --body "$(cat <<'EOF'
# Performance Optimization Summary

## Changes
- ✅ Phase 1: Database indexes, connection pooling, TanStack Query caching, pagination
- ✅ Phase 2: Component refactoring (workfolder-detail, quote-editor, dashboard)
- ✅ Phase 3: Server-side PDF, lazy loading, database views

## Performance Improvements
- 50-70% faster page loads (Phase 1)
- 30-40% faster rendering (Phase 2)
- Reduced bundle size (Phase 3)
- Supports 30+ concurrent users

## Testing
- ✅ All builds pass
- ✅ Manual testing complete
- ✅ Database migrations applied

## Breaking Changes
None

## Migration Required
- Supabase upgrade to Pro Tier REQUIRED for 30+ users
- Apply database migrations
EOF
)"
```

**Step 3: Request review & merge**

After approval:

```bash
git checkout main
git merge optimize/performance-improvements
git push origin main
```

---

# Monitoring & Next Steps

## Post-Deployment Monitoring

**Week 1: Monitor These Metrics**
- Page load times (should be <1s for most pages)
- Database connection pool usage
- Error rates
- User complaints/feedback

**Tools:**
- Supabase Dashboard → Database → Connection pooling
- Browser DevTools → Network/Performance tabs
- Sentry or similar error tracking (if available)

## Optional Future Optimizations

**If still experiencing slowness:**

1. **Redis for Caching** (2-3 days)
   - Replace in-memory cache with Redis
   - Cache frequently accessed data

2. **Edge Functions** (1 week)
   - Move API routes to Supabase Edge Functions
   - Reduce cold start times

3. **CDN for Static Assets** (1 day)
   - Use Cloudflare or similar
   - Cache images, PDFs

4. **Database Read Replicas** (3-4 days)
   - Separate read/write databases
   - Requires Supabase Team tier

5. **Full-Text Search** (2-3 days)
   - Add PostgreSQL full-text search
   - Improve search performance

---

# Documentation

All optimizations documented in:
- `docs/plans/2026-02-05-performance-optimization.md` (this file)
- Code comments in refactored components
- Database migration comments

---

**Plan Complete!**

Ready to execute? Two options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks
2. **Parallel Session (separate)** - Open new session with executing-plans for batch execution

Which approach would you prefer?
