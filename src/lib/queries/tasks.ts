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
        .neq('status', 'done')
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
