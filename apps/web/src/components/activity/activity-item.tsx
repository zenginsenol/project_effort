'use client';

import {
  CheckCircle2,
  FileBarChart,
  FileText,
  GitPullRequest,
  ListTodo,
  RefreshCw,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

type ActivityType =
  | 'task_created'
  | 'task_updated'
  | 'task_status_changed'
  | 'session_created'
  | 'session_completed'
  | 'cost_analysis_created'
  | 'cost_analysis_exported'
  | 'integration_sync_completed'
  | 'member_joined'
  | 'member_left'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted';

interface Activity {
  id: string;
  organizationId: string;
  projectId?: string | null;
  actorId?: string | null;
  activityType: ActivityType;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ActivityItemProps {
  activity: Activity;
  showProject?: boolean;
}

function getActivityIcon(type: ActivityType): React.ReactElement {
  const iconClass = 'h-4 w-4';

  switch (type) {
    case 'task_created':
    case 'task_updated':
      return <FileText className={iconClass} />;
    case 'task_status_changed':
      return <ListTodo className={iconClass} />;
    case 'session_created':
    case 'session_completed':
      return <Users className={iconClass} />;
    case 'cost_analysis_created':
    case 'cost_analysis_exported':
      return <FileBarChart className={iconClass} />;
    case 'integration_sync_completed':
      return <RefreshCw className={iconClass} />;
    case 'member_joined':
      return <UserPlus className={iconClass} />;
    case 'member_left':
      return <UserMinus className={iconClass} />;
    case 'project_created':
    case 'project_updated':
      return <GitPullRequest className={iconClass} />;
    case 'project_deleted':
      return <Trash2 className={iconClass} />;
    default:
      return <CheckCircle2 className={iconClass} />;
  }
}

function getActivityColor(type: ActivityType): string {
  switch (type) {
    case 'task_created':
    case 'session_created':
    case 'cost_analysis_created':
    case 'member_joined':
    case 'project_created':
      return 'text-green-600 bg-green-600/10 border-green-600/20';
    case 'task_updated':
    case 'session_completed':
    case 'cost_analysis_exported':
    case 'integration_sync_completed':
    case 'project_updated':
      return 'text-blue-600 bg-blue-600/10 border-blue-600/20';
    case 'task_status_changed':
      return 'text-yellow-600 bg-yellow-600/10 border-yellow-600/20';
    case 'member_left':
    case 'project_deleted':
      return 'text-red-600 bg-red-600/10 border-red-600/20';
    default:
      return 'text-muted-foreground bg-muted/10 border-border';
  }
}

function formatActivityDescription(activity: Activity): string {
  const metadata = activity.metadata as Record<string, unknown> | null | undefined;

  switch (activity.activityType) {
    case 'task_created':
      return `created task "${metadata?.title ?? 'Untitled'}"`;
    case 'task_updated':
      return `updated task "${metadata?.title ?? 'Untitled'}"`;
    case 'task_status_changed':
      return `changed task status from ${metadata?.oldStatus ?? 'unknown'} to ${metadata?.newStatus ?? 'unknown'}`;
    case 'session_created':
      return `created estimation session`;
    case 'session_completed':
      return `completed estimation session`;
    case 'cost_analysis_created':
      return `created cost analysis`;
    case 'cost_analysis_exported':
      return `exported cost analysis`;
    case 'integration_sync_completed':
      return `completed ${metadata?.integrationType ?? 'integration'} sync`;
    case 'member_joined':
      return `joined the organization`;
    case 'member_left':
      return `left the organization`;
    case 'project_created':
      return `created project "${metadata?.name ?? 'Untitled'}"`;
    case 'project_updated':
      return `updated project "${metadata?.name ?? 'Untitled'}"`;
    case 'project_deleted':
      return `deleted project "${metadata?.name ?? 'Untitled'}"`;
    default:
      return `performed an action`;
  }
}

function getEntityLink(activity: Activity): string | null {
  const { entityType, entityId, projectId } = activity;

  switch (entityType) {
    case 'task':
      return projectId ? `/dashboard/projects/${projectId}/tasks/${entityId}` : null;
    case 'session':
      return projectId ? `/dashboard/projects/${projectId}/sessions/${entityId}` : null;
    case 'cost_analysis':
      return `/dashboard/cost-analysis/${entityId}`;
    case 'project':
      return `/dashboard/projects/${entityId}`;
    case 'integration':
      return `/dashboard/settings/integrations`;
    case 'member':
      return `/dashboard/settings/members`;
    default:
      return null;
  }
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const activityDate = typeof date === 'string' ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - activityDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

export function ActivityItem({ activity, showProject = false }: ActivityItemProps): React.ReactElement {
  const actorName = (activity.metadata?.actorName as string | undefined) ?? 'Someone';
  const projectName = (activity.metadata?.projectName as string | undefined) ?? 'Unknown Project';
  const entityLink = getEntityLink(activity);
  const description = formatActivityDescription(activity);
  const timeAgo = formatTimeAgo(activity.createdAt);
  const colorClasses = getActivityColor(activity.activityType);

  const content = (
    <div className="flex items-start gap-3">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border', colorClasses)}>
        {getActivityIcon(activity.activityType)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-semibold">{actorName}</span>
          {' '}
          <span className="text-muted-foreground">{description}</span>
        </p>
        {showProject && activity.projectId && (
          <p className="text-xs text-muted-foreground mt-0.5">
            in project: {projectName}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>
    </div>
  );

  if (entityLink) {
    return (
      <Link
        href={entityLink}
        className="block rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      {content}
    </div>
  );
}
