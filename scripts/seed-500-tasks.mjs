#!/usr/bin/env node
/**
 * Seed database with a test project containing 500 tasks
 * Usage: node scripts/seed-500-tasks.mjs
 */

import { Client } from 'pg';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/estimate_pro';

async function seedTasks() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Create test organization
    const orgId = crypto.randomUUID();
    await client.query(`
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES ($1, 'Test Org - Performance', 'test-org-perf', NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET id = $1
      RETURNING id
    `, [orgId]);
    console.log(`✓ Created/updated test organization: ${orgId}`);

    // Create test project
    const projectId = crypto.randomUUID();
    await client.query(`
      INSERT INTO projects (id, organization_id, name, description, status, created_at, updated_at)
      VALUES ($1, $2, 'Performance Test Project - 500 Tasks', 'Project for testing task list performance with 500 tasks', 'active', NOW(), NOW())
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [projectId, orgId]);
    console.log(`✓ Created test project: ${projectId}`);

    // Check existing task count
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id = $1',
      [projectId]
    );
    const existingCount = parseInt(countResult.rows[0].count);

    if (existingCount >= 500) {
      console.log(`✓ Project already has ${existingCount} tasks, no need to seed more`);
      console.log(`\nProject ID: ${projectId}`);
      console.log(`Organization ID: ${orgId}`);
      process.exit(0);
    }

    const tasksToCreate = 500 - existingCount;
    console.log(`Creating ${tasksToCreate} tasks...`);

    // Generate 500 tasks in batches
    const BATCH_SIZE = 50;
    const statuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
    const types = ['epic', 'feature', 'story', 'task', 'subtask', 'bug'];
    const priorities = ['critical', 'high', 'medium', 'low', 'none'];

    for (let batch = 0; batch < Math.ceil(tasksToCreate / BATCH_SIZE); batch++) {
      const batchStart = batch * BATCH_SIZE + existingCount;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, 500);
      const batchSize = batchEnd - batchStart;

      const values = [];
      const params = [];
      let paramIndex = 1;

      for (let i = batchStart; i < batchEnd; i++) {
        const taskId = crypto.randomUUID();
        const status = statuses[i % statuses.length];
        const type = types[i % types.length];
        const priority = priorities[i % priorities.length];
        const estimatedPoints = Math.floor(Math.random() * 8) + 1;
        const estimatedHours = estimatedPoints * 2;

        values.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW(), NOW())`
        );

        params.push(
          taskId,
          projectId,
          `Task ${i + 1} - Performance Test`,
          `Description for task ${i + 1}`,
          status,
          type,
          priority,
          estimatedPoints,
          estimatedHours
        );
      }

      const query = `
        INSERT INTO tasks (id, project_id, title, description, status, type, priority, estimated_points, estimated_hours, created_at, updated_at)
        VALUES ${values.join(', ')}
      `;

      await client.query(query, params);
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
    await client.end();
  }
}

seedTasks();
