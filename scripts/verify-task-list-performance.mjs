#!/usr/bin/env node
/**
 * Verify project task list loads under 150ms for 500 tasks
 * Usage: node scripts/verify-task-list-performance.mjs [projectId]
 */

import { Client } from 'pg';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/estimate_pro';

// Performance targets from acceptance criteria
const MAX_LOAD_TIME_MS = 150;
const EXPECTED_INITIAL_PAGE_SIZE = 20;

async function verifyTaskListPerformance(projectId) {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Verify project exists and has 500 tasks
    const projectCheck = await client.query(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id = $1',
      [projectId]
    );

    const taskCount = parseInt(projectCheck.rows[0].count);
    if (taskCount < 500) {
      console.error(`❌ Project has only ${taskCount} tasks, expected 500`);
      console.error(`Run: node scripts/seed-500-tasks.mjs`);
      process.exit(1);
    }

    console.log(`✓ Project has ${taskCount} tasks`);

    // Test 1: Initial page load (first 20 tasks)
    console.log('\n📊 Test 1: Initial page load (first 20 tasks)');
    const startTime1 = Date.now();

    const initialPageResult = await client.query(`
      SELECT * FROM tasks
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [projectId]);

    const loadTime1 = Date.now() - startTime1;

    console.log(`  Load time: ${loadTime1}ms`);
    console.log(`  Tasks returned: ${initialPageResult.rows.length}`);
    console.log(`  Expected: ${EXPECTED_INITIAL_PAGE_SIZE}`);

    if (initialPageResult.rows.length !== EXPECTED_INITIAL_PAGE_SIZE) {
      console.error(`  ❌ Expected ${EXPECTED_INITIAL_PAGE_SIZE} tasks, got ${initialPageResult.rows.length}`);
      process.exit(1);
    }

    if (loadTime1 > MAX_LOAD_TIME_MS) {
      console.error(`  ❌ Load time ${loadTime1}ms exceeds target of ${MAX_LOAD_TIME_MS}ms`);
      process.exit(1);
    }

    console.log(`  ✅ PASSED: Load time under ${MAX_LOAD_TIME_MS}ms`);
    console.log(`  ✅ PASSED: Pagination returns ${EXPECTED_INITIAL_PAGE_SIZE} tasks`);

    // Test 2: Cached query (should be faster)
    console.log('\n📊 Test 2: Cached query (second load)');
    const startTime2 = Date.now();

    await client.query(`
      SELECT * FROM tasks
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [projectId]);

    const loadTime2 = Date.now() - startTime2;
    console.log(`  Load time: ${loadTime2}ms`);
    console.log(`  ✅ Cached query completed`);

    // Test 3: Query with index usage verification
    console.log('\n📊 Test 3: Index usage verification');
    const explainResult = await client.query(`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM tasks
      WHERE project_id = $1 AND status = 'todo'
      ORDER BY created_at DESC
      LIMIT 20
    `, [projectId]);

    const queryPlan = JSON.stringify(explainResult.rows[0]);
    const usesIndex = queryPlan.includes('Index Scan') || queryPlan.includes('Bitmap Index Scan');

    if (usesIndex) {
      console.log(`  ✅ Query uses index (optimized)`);
    } else {
      console.log(`  ⚠️  Query might not use index (check composite indexes)`);
    }

    // Test 4: Filtered query performance
    console.log('\n📊 Test 4: Filtered query performance (status filter)');
    const startTime4 = Date.now();

    const filteredResult = await client.query(`
      SELECT * FROM tasks
      WHERE project_id = $1 AND status = 'in_progress'
      ORDER BY created_at DESC
      LIMIT 20
    `, [projectId]);

    const loadTime4 = Date.now() - startTime4;
    console.log(`  Load time: ${loadTime4}ms`);
    console.log(`  Tasks returned: ${filteredResult.rows.length}`);

    if (loadTime4 > MAX_LOAD_TIME_MS) {
      console.error(`  ❌ Filtered query ${loadTime4}ms exceeds target of ${MAX_LOAD_TIME_MS}ms`);
      process.exit(1);
    }

    console.log(`  ✅ PASSED: Filtered query under ${MAX_LOAD_TIME_MS}ms`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('Performance Summary:');
    console.log(`  Initial page load: ${loadTime1}ms (target: <${MAX_LOAD_TIME_MS}ms)`);
    console.log(`  Cached load: ${loadTime2}ms`);
    console.log(`  Filtered query: ${loadTime4}ms (target: <${MAX_LOAD_TIME_MS}ms)`);
    console.log(`  Pagination size: ${EXPECTED_INITIAL_PAGE_SIZE} tasks`);
    console.log(`  Total tasks in project: ${taskCount}`);
    console.log(`  Index optimization: ${usesIndex ? 'YES' : 'CHECK NEEDED'}`);
    console.log('='.repeat(60));

    console.log('\n✅ Task list performance verification: SUCCESS');
    console.log(`✅ Meets acceptance criteria: Task list loads under ${MAX_LOAD_TIME_MS}ms for 500 tasks`);

  } catch (error) {
    console.error('❌ Error verifying task list performance:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Get project ID from command line or environment
const projectId = process.argv[2] || process.env.TEST_PROJECT_ID;

if (!projectId) {
  console.error('❌ Project ID required');
  console.error('Usage: node scripts/verify-task-list-performance.mjs [projectId]');
  console.error('  Or set TEST_PROJECT_ID environment variable');
  console.error('\nRun: node scripts/seed-500-tasks.mjs to create a test project');
  process.exit(1);
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(projectId)) {
  console.error(`❌ Invalid project ID format: ${projectId}`);
  console.error('Expected UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
  process.exit(1);
}

console.log('🚀 Task List Performance Verification');
console.log('='.repeat(60));
console.log(`Project ID: ${projectId}`);
console.log(`Target: Load time < ${MAX_LOAD_TIME_MS}ms`);
console.log(`Expected page size: ${EXPECTED_INITIAL_PAGE_SIZE} tasks`);
console.log('='.repeat(60));

verifyTaskListPerformance(projectId);
