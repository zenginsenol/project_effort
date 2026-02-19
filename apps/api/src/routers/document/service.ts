import { db } from '@estimate-pro/db';
import { tasks } from '@estimate-pro/db/schema';

import { hasProjectAccess } from '../../services/security/tenant-access';

interface TaskInput {
  title: string;
  description?: string;
  type?: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug';
  priority?: 'critical' | 'high' | 'medium' | 'low' | 'none';
  estimatedHours?: number;
  estimatedPoints?: number;
  status?: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
}

export class DocumentService {
  async bulkCreateTasks(projectId: string, taskInputs: TaskInput[], orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      throw new Error('Project access denied');
    }

    const results = [];

    // Insert in batches of 20 to avoid overwhelming the DB
    const batchSize = 20;
    for (let i = 0; i < taskInputs.length; i += batchSize) {
      const batch = taskInputs.slice(i, i + batchSize);
      const values = batch.map((t, idx) => ({
        projectId,
        title: t.title,
        description: t.description ?? null,
        type: t.type ?? 'task' as const,
        priority: t.priority ?? 'medium' as const,
        status: t.status ?? 'backlog' as const,
        estimatedHours: t.estimatedHours ?? null,
        estimatedPoints: t.estimatedPoints ?? null,
        sortOrder: i + idx,
      }));

      const inserted = await db.insert(tasks).values(values).returning();
      results.push(...inserted);
    }

    return results;
  }
}

export const documentService = new DocumentService();
