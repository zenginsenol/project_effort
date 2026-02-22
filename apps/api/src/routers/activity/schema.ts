import { z } from 'zod';

// Activity type enum matching database schema
const activityTypeValues = [
  'task_created',
  'task_updated',
  'task_status_changed',
  'session_created',
  'session_completed',
  'cost_analysis_created',
  'cost_analysis_exported',
  'integration_sync_completed',
  'member_joined',
  'member_left',
  'project_created',
  'project_updated',
  'project_deleted',
] as const;

export const createActivityInput = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  activityType: z.enum(activityTypeValues),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

export const listActivitiesInput = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  activityType: z.enum(activityTypeValues).optional(),
  entityType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const getActivityInput = z.object({
  id: z.string().uuid(),
});
