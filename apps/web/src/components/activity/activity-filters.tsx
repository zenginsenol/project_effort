'use client';

import { Filter, X } from 'lucide-react';
import { useState } from 'react';

import { trpc } from '@/lib/trpc';

interface ActivityFiltersProps {
  organizationId: string;
  filters: {
    projectId?: string;
    activityType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
  };
  onFiltersChange: (filters: {
    projectId?: string;
    activityType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
  }) => void;
}

const ACTIVITY_TYPES = [
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'task_status_changed', label: 'Task Status Changed' },
  { value: 'session_created', label: 'Session Created' },
  { value: 'session_completed', label: 'Session Completed' },
  { value: 'cost_analysis_created', label: 'Cost Analysis Created' },
  { value: 'cost_analysis_exported', label: 'Cost Analysis Exported' },
  { value: 'integration_sync_completed', label: 'Integration Sync Completed' },
  { value: 'member_joined', label: 'Member Joined' },
  { value: 'member_left', label: 'Member Left' },
  { value: 'project_created', label: 'Project Created' },
  { value: 'project_updated', label: 'Project Updated' },
  { value: 'project_deleted', label: 'Project Deleted' },
] as const;

export function ActivityFilters({ organizationId, filters, onFiltersChange }: ActivityFiltersProps): React.ReactElement {
  const [showFilters, setShowFilters] = useState(false);

  const projectsQuery = trpc.project.list.useQuery({ organizationId }, { retry: false, enabled: Boolean(organizationId) });
  const teamQuery = trpc.team.list.useQuery({ organizationId }, { retry: false, enabled: Boolean(organizationId) });

  const projects = projectsQuery.data ?? [];
  const teamMembers = teamQuery.data ?? [];

  const hasActiveFilters = Boolean(filters.projectId || filters.activityType || filters.actorId || filters.startDate || filters.endDate);

  function handleClearFilters(): void {
    onFiltersChange({});
  }

  function handleProjectChange(projectId: string): void {
    onFiltersChange({ ...filters, projectId: projectId || undefined });
  }

  function handleActivityTypeChange(activityType: string): void {
    onFiltersChange({ ...filters, activityType: activityType || undefined });
  }

  function handleActorChange(actorId: string): void {
    onFiltersChange({ ...filters, actorId: actorId || undefined });
  }

  function handleStartDateChange(startDate: string): void {
    onFiltersChange({ ...filters, startDate: startDate || undefined });
  }

  function handleEndDateChange(endDate: string): void {
    onFiltersChange({ ...filters, endDate: endDate || undefined });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Filter className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{Object.values(filters).filter(Boolean).length}</span>}
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-lg border bg-background p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Project Filter */}
            <div>
              <label htmlFor="project-filter" className="mb-1.5 block text-sm font-medium">
                Project
              </label>
              <select
                id="project-filter"
                value={filters.projectId ?? ''}
                onChange={(event) => handleProjectChange(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.key} - {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Activity Type Filter */}
            <div>
              <label htmlFor="activity-type-filter" className="mb-1.5 block text-sm font-medium">
                Activity Type
              </label>
              <select
                id="activity-type-filter"
                value={filters.activityType ?? ''}
                onChange={(event) => handleActivityTypeChange(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Types</option>
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Team Member Filter */}
            <div>
              <label htmlFor="actor-filter" className="mb-1.5 block text-sm font-medium">
                Team Member
              </label>
              <select
                id="actor-filter"
                value={filters.actorId ?? ''}
                onChange={(event) => handleActorChange(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Members</option>
                {teamMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user?.name ?? 'Unknown User'}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label htmlFor="start-date-filter" className="mb-1.5 block text-sm font-medium">
                Start Date
              </label>
              <input
                id="start-date-filter"
                type="date"
                value={filters.startDate?.split('T')[0] ?? ''}
                onChange={(event) => handleStartDateChange(event.target.value ? new Date(event.target.value).toISOString() : '')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label htmlFor="end-date-filter" className="mb-1.5 block text-sm font-medium">
                End Date
              </label>
              <input
                id="end-date-filter"
                type="date"
                value={filters.endDate?.split('T')[0] ?? ''}
                onChange={(event) => handleEndDateChange(event.target.value ? new Date(event.target.value).toISOString() : '')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
