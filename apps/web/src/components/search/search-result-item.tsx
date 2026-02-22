'use client';

import { Calendar, DollarSign, FileText, FolderKanban, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { SearchResultItem } from '@/types/search';

interface SearchResultItemProps {
  result: SearchResultItem;
  onSelect: (result: SearchResultItem) => void;
  isSelected?: boolean;
}

function getEntityIcon(entityType: string): React.ReactElement {
  switch (entityType) {
    case 'projects':
      return <FolderKanban className="h-4 w-4" />;
    case 'tasks':
      return <FileText className="h-4 w-4" />;
    case 'cost_analyses':
      return <DollarSign className="h-4 w-4" />;
    case 'sessions':
      return <Users className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getEntityLabel(entityType: string): string {
  switch (entityType) {
    case 'projects':
      return 'Project';
    case 'tasks':
      return 'Task';
    case 'cost_analyses':
      return 'Cost Analysis';
    case 'sessions':
      return 'Estimation Session';
    default:
      return entityType;
  }
}

function getEntityColor(entityType: string): string {
  switch (entityType) {
    case 'projects':
      return 'text-blue-600 dark:text-blue-400';
    case 'tasks':
      return 'text-green-600 dark:text-green-400';
    case 'cost_analyses':
      return 'text-amber-600 dark:text-amber-400';
    case 'sessions':
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-muted-foreground';
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function SearchResultItem({
  result,
  onSelect,
  isSelected = false,
}: SearchResultItemProps): React.ReactElement {
  const entityColor = getEntityColor(result.entityType);
  const entityLabel = getEntityLabel(result.entityType);

  // Create accessible label for screen readers
  const ariaLabel = `${entityLabel}: ${result.title}${result.projectName ? `, in project ${result.projectName}` : ''}`;

  return (
    <button
      onClick={() => onSelect(result)}
      className={cn(
        'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50',
      )}
      aria-label={ariaLabel}
    >
      <div className={cn('mt-0.5 shrink-0', entityColor)}>
        {getEntityIcon(result.entityType)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {result.title}
            </p>
            {result.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {result.description}
              </p>
            )}
          </div>
          {result.status && (
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
              {result.status}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('font-medium', entityColor)}>
            {getEntityLabel(result.entityType)}
          </span>
          {result.projectName && (
            <>
              <span>·</span>
              <span className="truncate">{result.projectName}</span>
            </>
          )}
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(result.updatedAt)}
          </span>
        </div>
      </div>
    </button>
  );
}
