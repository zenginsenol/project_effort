import { cosineDistance, desc, eq, sql } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { taskEmbeddings } from '@estimate-pro/db/schema';
import { tasks } from '@estimate-pro/db/schema';

import { generateEmbedding } from './openai-client';
import { sanitizeForAI } from './sanitizer';

export async function findSimilarTasks(
  text: string,
  projectId: string,
  limit = 5,
): Promise<Array<{
  taskId: string;
  title: string;
  similarity: number;
  estimatedPoints: number | null;
  estimatedHours: number | null;
}>> {
  const { text: sanitized, isInjection } = sanitizeForAI(text);
  if (isInjection) {
    return [];
  }

  try {
    const embedding = await generateEmbedding(sanitized);
    if (embedding.length === 0) return [];

    const similarity = sql<number>`1 - (${cosineDistance(taskEmbeddings.embedding, embedding)})`;

    const results = await db
      .select({
        taskId: taskEmbeddings.taskId,
        title: tasks.title,
        similarity,
        estimatedPoints: tasks.estimatedPoints,
        estimatedHours: tasks.estimatedHours,
      })
      .from(taskEmbeddings)
      .innerJoin(tasks, eq(taskEmbeddings.taskId, tasks.id))
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(similarity))
      .limit(limit);

    return results.map((r) => ({
      taskId: r.taskId,
      title: r.title,
      similarity: Math.round((r.similarity ?? 0) * 100) / 100,
      estimatedPoints: r.estimatedPoints,
      estimatedHours: r.estimatedHours,
    }));
  } catch (error) {
    console.error('Similarity search failed:', error);
    return [];
  }
}

export async function generateAndStoreEmbedding(taskId: string, title: string, description?: string): Promise<void> {
  const textContent = description ? `${title}\n${description}` : title;
  const { text: sanitized, isInjection } = sanitizeForAI(textContent);

  if (isInjection) {
    console.warn(`Prompt injection detected for task ${taskId}, skipping embedding`);
    return;
  }

  try {
    const embedding = await generateEmbedding(sanitized);
    if (embedding.length === 0) return;

    await db
      .insert(taskEmbeddings)
      .values({
        taskId,
        embedding,
        textContent: sanitized,
      })
      .onConflictDoUpdate({
        target: taskEmbeddings.taskId,
        set: {
          embedding,
          textContent: sanitized,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`Failed to generate embedding for task ${taskId}:`, error);
  }
}
