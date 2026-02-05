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
