'use client';

import { BarChart3, Brain, FolderKanban, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

interface UsageItem {
  label: string;
  current: number;
  limit: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

interface UsageChartProps {
  aiAnalyses?: { current: number; limit: number };
  projects?: { current: number; limit: number };
  teamMembers?: { current: number; limit: number };
  loading?: boolean;
}

export function UsageChart({
  aiAnalyses,
  projects,
  teamMembers,
  loading = false,
}: UsageChartProps): React.ReactElement {
  const usageItems: UsageItem[] = [
    {
      label: 'AI Analyses',
      current: aiAnalyses?.current ?? 0,
      limit: aiAnalyses?.limit ?? 10,
      icon: Brain,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500',
    },
    {
      label: 'Projects',
      current: projects?.current ?? 0,
      limit: projects?.limit ?? 2,
      icon: FolderKanban,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500',
    },
    {
      label: 'Team Members',
      current: teamMembers?.current ?? 0,
      limit: teamMembers?.limit ?? 5,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-500',
    },
  ];

  const calculatePercentage = (current: number, limit: number): number => {
    if (limit === -1) return 0; // Unlimited
    return Math.min(100, (current / limit) * 100);
  };

  const formatLimit = (value: number): string => {
    if (value === -1) return 'Unlimited';
    return value.toLocaleString();
  };

  const getUsageStatus = (current: number, limit: number): { text: string; color: string } => {
    if (limit === -1) {
      return { text: 'Unlimited', color: 'text-muted-foreground' };
    }
    const percentage = (current / limit) * 100;
    if (percentage >= 90) return { text: 'Near limit', color: 'text-red-600' };
    if (percentage >= 70) return { text: 'High usage', color: 'text-orange-600' };
    return { text: 'Good', color: 'text-green-600' };
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Usage Statistics</h2>
        <div className="space-y-6">
          {[1, 2, 3].map((index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usage Statistics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your current usage against plan limits
          </p>
        </div>
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
      </div>

      <div className="space-y-6">
        {usageItems.map((item) => {
          const Icon = item.icon;
          const percentage = calculatePercentage(item.current, item.limit);
          const status = getUsageStatus(item.current, item.limit);
          const isUnlimited = item.limit === -1;

          return (
            <div key={item.label} className="space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-5 w-5', item.color)} />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('text-xs font-medium', status.color)}>
                    {status.text}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.current.toLocaleString()} / {formatLimit(item.limit)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    item.bgColor,
                    isUnlimited && 'opacity-30',
                  )}
                  style={{ width: isUnlimited ? '100%' : `${percentage}%` }}
                />
              </div>

              {/* Percentage Label (only if not unlimited) */}
              {!isUnlimited && (
                <div className="flex justify-end">
                  <span className="text-xs text-muted-foreground">
                    {percentage.toFixed(1)}% used
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Card */}
      <div className="mt-6 rounded-md bg-muted/50 p-4">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-blue-500/20 p-0.5">
            <div className="h-full w-full rounded-full bg-blue-500" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium">Usage Tip</p>
            <p className="mt-1 text-muted-foreground">
              Upgrade your plan to increase limits and unlock more features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
