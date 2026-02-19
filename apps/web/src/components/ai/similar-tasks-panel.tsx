'use client';

import { Sparkles } from 'lucide-react';

interface SimilarTask {
  taskId: string;
  title: string;
  similarity: number;
  estimatedPoints: number | null;
  estimatedHours: number | null;
}

interface SimilarTasksPanelProps {
  tasks: SimilarTask[];
  isLoading?: boolean;
}

export function SimilarTasksPanel({ tasks, isLoading }: SimilarTasksPanelProps): React.ReactElement {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
          <span className="text-sm font-medium">Finding similar tasks...</span>
        </div>
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No similar tasks found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Similar Tasks</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {tasks.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {tasks.map((task) => (
          <div key={task.taskId} className="rounded-md border p-3 transition-colors hover:bg-muted/50">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-tight">{task.title}</p>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {Math.round(task.similarity * 100)}%
              </span>
            </div>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              {task.estimatedPoints !== null && (
                <span>{task.estimatedPoints} points</span>
              )}
              {task.estimatedHours !== null && (
                <span>{task.estimatedHours}h</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
