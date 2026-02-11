'use client';

import { memo, useMemo } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMyTasks } from '@/lib/queries/tasks';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface TasksSectionProps {
  userId: string;
}

export const TasksSection = memo(function TasksSection({ userId }: TasksSectionProps) {
  const router = useRouter();
  const supabase = createClient();

  // Fetch regular standalone tasks
  const { data: regularTasks, isLoading: loadingRegular } = useMyTasks(userId);

  // Fetch project tasks
  const { data: projectTasks, isLoading: loadingProject } = useQuery({
    queryKey: ['project_tasks', 'my', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*, project:projects(id, name, slug)')
        .eq('assigned_user_id', userId)
        .in('status', ['open', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(8);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch unassigned tasks (both standalone and project tasks)
  const { data: openStandaloneTasks, isLoading: loadingOpenStandalone } = useQuery({
    queryKey: ['tasks', 'unassigned'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .is('assigned_to', null)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Combine and sort tasks by due date
  const combinedTasks = useMemo(() => {
    if (!regularTasks && !projectTasks) return [];

    const tasks = [
      ...(regularTasks || []).map(t => ({ ...t, _source: 'tasks' })),
      ...(projectTasks || []).map(t => ({ ...t, _source: 'project_tasks' })),
    ];

    return tasks.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }).slice(0, 8);
  }, [regularTasks, projectTasks]);

  if (loadingRegular || loadingProject || loadingOpenStandalone) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-2xl bg-[#111] border border-[#1a1a1a]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-neutral-700 rounded w-1/3"></div>
            <div className="h-20 bg-neutral-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Tasks */}
      <section className="p-4 rounded-2xl bg-[#111] border border-[#1a1a1a]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">
              <CheckCircle className="w-4 h-4" />
            </span>
            <h2 className="font-semibold text-white">Meine Aufgaben</h2>
            {combinedTasks.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#fa432a]/10 text-[#fa432a] rounded">
                {combinedTasks.length}
              </span>
            )}
          </div>
        </div>

        {combinedTasks.length > 0 ? (
          <div className="space-y-1.5">
            {combinedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => {
                  if (task._source === 'project_tasks' && task.project?.slug) {
                    router.push(`/projects/${task.project.slug}?tab=tasks`);
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center text-neutral-600 py-6">
            <p className="text-sm">Keine offenen Aufgaben</p>
          </div>
        )}
      </section>

      {/* Unassigned Tasks */}
      {openStandaloneTasks && openStandaloneTasks.length > 0 && (
        <section className="p-4 rounded-2xl bg-[#0a0a0a] border border-[#141414]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">
                <AlertCircle className="w-4 h-4" />
              </span>
              <h2 className="font-semibold text-neutral-400">Nicht zugewiesen</h2>
            </div>
          </div>

          <div className="space-y-1.5">
            {openStandaloneTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                compact
                onClick={() => {
                  if (task.project?.slug) {
                    router.push(`/projects/${task.project.slug}?tab=tasks`);
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
});

// Task Card Component
function TaskCard({ task, compact, onClick }: { task: any; compact?: boolean; onClick?: () => void }) {
  const statusColors: Record<string, string> = {
    open: 'bg-orange-500',
    in_progress: 'bg-blue-500',
    blocked: 'bg-red-500',
    done: 'bg-green-500',
  };

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';
  const projectName = task.project?.name;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${statusColors[task.status || 'open']}`} />
        <span className="text-sm text-neutral-400 truncate flex-1">{task.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 bg-[#0d0d0d] rounded-lg hover:bg-[#121212] transition-colors text-left"
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[task.status || 'open']}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{task.title}</div>
        {projectName && (
          <div className="text-[10px] text-neutral-500 truncate">{projectName}</div>
        )}
      </div>
      {dueDate && (
        <div className={`text-[10px] px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500/10 text-red-400' : 'text-neutral-500'}`}>
          {dueDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
        </div>
      )}
    </button>
  );
}
