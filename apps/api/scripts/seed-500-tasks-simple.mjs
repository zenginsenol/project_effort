#!/usr/bin/env node
/**
 * Seed database with a test project containing 500 tasks
 * Simple version without external dependencies
 * Usage: node scripts/seed-500-tasks-simple.mjs
 */

import crypto from 'crypto';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://estimatepro:estimatepro_dev@localhost:5433/estimatepro';

async function seedTasks() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('✓ Connected to database');

    // Create test organization
    const orgSlug = 'test-org-perf';
    const orgResult = await sql`
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, 'Test Org - Performance', ${orgSlug}, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET id = organizations.id
      RETURNING id
    `;

    const orgId = orgResult[0].id;
    console.log(`✓ Created/updated test organization: ${orgId}`);

    // Create test project
    const projectName = 'Performance Test Project - 500 Tasks';
    const projectResult = await sql`
      INSERT INTO projects (id, organization_id, name, description, status, created_at, updated_at)
      VALUES (
        ${crypto.randomUUID()},
        ${orgId},
        ${projectName},
        'Project for testing task list performance with 500 tasks',
        'active',
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    let projectId;
    if (projectResult.length > 0) {
      projectId = projectResult[0].id;
      console.log(`✓ Created test project: ${projectId}`);
    } else {
      // Project already exists, get its ID
      const existing = await sql`
        SELECT id FROM projects
        WHERE organization_id = ${orgId} AND name = ${projectName}
        LIMIT 1
      `;
      projectId = existing[0].id;
      console.log(`✓ Using existing test project: ${projectId}`);
    }

    // Check existing task count
    const countResult = await sql`
      SELECT COUNT(*) as count FROM tasks WHERE project_id = ${projectId}
    `;
    const existingCount = parseInt(countResult[0].count);

    if (existingCount >= 500) {
      console.log(`✓ Project already has ${existingCount} tasks, no need to seed more`);
      console.log(`\nProject ID: ${projectId}`);
      console.log(`Organization ID: ${orgId}`);
      await sql.end();
      process.exit(0);
    }

    const tasksToCreate = 500 - existingCount;
    console.log(`Creating ${tasksToCreate} tasks...`);

    // Generate tasks in batches
    const BATCH_SIZE = 50;
    const statuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
    const types = ['epic', 'feature', 'story', 'task', 'subtask', 'bug'];
    const priorities = ['critical', 'high', 'medium', 'low', 'none'];

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
          project_id: projectId,
          title: `Task ${i + 1} - Performance Test`,
          description: `Description for task ${i + 1}`,
          status,
          type,
          priority,
          estimated_points: estimatedPoints,
          estimated_hours: estimatedHours,
          sort_order: i,
          created_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        });
      }

      await sql`
        INSERT INTO tasks ${sql(taskValues)}
      `;

      console.log(`  ✓ Created tasks ${batchStart + 1} to ${batchEnd}`);
    }

    console.log(`\n✅ Successfully seeded ${tasksToCreate} tasks!`);
    console.log(`\nProject details:`);
    console.log(`  Project ID: ${projectId}`);
    console.log(`  Organization ID: ${orgId}`);
    console.log(`  Total tasks: 500`);
    console.log(`\nTest this project at:`);
    console.log(`  http://localhost:3000/dashboard/projects/${projectId}`);

    await sql.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding tasks:', error);
    await sql.end();
    process.exit(1);
  }
}

seedTasks();
