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
        .gte('start_time', `${today}T00:00:00`)
        .lt('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: true });

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
        .gte('start_time', today.toISOString())
        .lte('start_time', future.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
