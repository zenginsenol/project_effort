#!/usr/bin/env tsx
/**
 * Seed database with a test project containing 500 tasks
 * Usage: npx tsx scripts/seed-500-tasks.ts
 */

import crypto from 'crypto';
import { db } from '../packages/db/src/index';
import { organizations, projects, tasks } from '../packages/db/src/schema';
import { eq } from 'drizzle-orm';

async function seedTasks() {
  try {
    console.log('✓ Connected to database');

    // Create test organization
    const orgSlug = 'test-org-perf';
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });

    const orgId = existingOrg?.id || crypto.randomUUID();

    if (!existingOrg) {
      await db.insert(organizations).values({
        id: orgId,
        name: 'Test Org - Performance',
        slug: orgSlug,
      });
      console.log(`✓ Created test organization: ${orgId}`);
    } else {
      console.log(`✓ Using existing test organization: ${orgId}`);
    }

    // Create test project
    const projectName = 'Performance Test Project - 500 Tasks';
    const existingProject = await db.query.projects.findFirst({
      where: (projects, { and, eq }) => and(
        eq(projects.organizationId, orgId),
        eq(projects.name, projectName)
      ),
    });

    const projectId = existingProject?.id || crypto.randomUUID();

    if (!existingProject) {
      await db.insert(projects).values({
        id: projectId,
        organizationId: orgId,
        name: projectName,
        description: 'Project for testing task list performance with 500 tasks',
        status: 'active',
      });
      console.log(`✓ Created test project: ${projectId}`);
    } else {
      console.log(`✓ Using existing test project: ${projectId}`);
    }

    // Check existing task count
    const existingTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, projectId),
    });

    const existingCount = existingTasks.length;

    if (existingCount >= 500) {
      console.log(`✓ Project already has ${existingCount} tasks, no need to seed more`);
      console.log(`\nProject ID: ${projectId}`);
      console.log(`Organization ID: ${orgId}`);
      process.exit(0);
    }

    const tasksToCreate = 500 - existingCount;
    console.log(`Creating ${tasksToCreate} tasks...`);

    // Generate tasks in batches
    const BATCH_SIZE = 50;
    const statuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
    const types = ['epic', 'feature', 'story', 'task', 'subtask', 'bug'] as const;
    const priorities = ['critical', 'high', 'medium', 'low', 'none'] as const;

    for (let batch = 0; batch < Math.ceil(tasksToCreate / BATCH_SIZE); batch++) {
      const batchStart = batch * BATCH_SIZE + existingCount;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, 500);

      const taskValues = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const status = statuses[i % statuses.length];
        const type = types[i % types.length];
        const priority = priorities[i % priorities.length];
        const estimatedPoints = Math.floor(Math.random() * 8) + 1;
        const estimatedHours = estimatedPoints * 2;

        taskValues.push({
          id: crypto.randomUUID(),
          projectId,
          title: `Task ${i + 1} - Performance Test`,
          description: `Description for task ${i + 1}`,
          status,
          type,
          priority,
          estimatedPoints,
          estimatedHours,
          sortOrder: i,
        });
      }

      await db.insert(tasks).values(taskValues);
      console.log(`  ✓ Created tasks ${batchStart + 1} to ${batchEnd}`);
    }

    console.log(`\n✅ Successfully seeded ${tasksToCreate} tasks!`);
    console.log(`\nProject details:`);
    console.log(`  Project ID: ${projectId}`);
    console.log(`  Organization ID: ${orgId}`);
    console.log(`  Total tasks: 500`);
    console.log(`\nTest this project at:`);
    console.log(`  http://localhost:3000/dashboard/projects/${projectId}`);

  } catch (error) {
    console.error('❌ Error seeding tasks:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedTasks();
