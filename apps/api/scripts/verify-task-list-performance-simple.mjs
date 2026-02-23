#!/usr/bin/env node
/**
 * Verify project task list loads under 150ms for 500 tasks
 * Simple version without external dependencies
 * Usage: node scripts/verify-task-list-performance-simple.mjs [projectId]
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://estimatepro:estimatepro_dev@localhost:5433/estimatepro';

// Performance targets from acceptance criteria
const MAX_LOAD_TIME_MS = 150;
const EXPECTED_INITIAL_PAGE_SIZE = 20;

async function verifyTaskListPerformance(projectId) {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('✓ Connected to database');

    // Verify project exists and has 500 tasks
    const countResult = await sql`
      SELECT COUNT(*) as count FROM tasks WHERE project_id = ${projectId}
    `;

    const taskCount = parseInt(countResult[0].count);
    if (taskCount < 500) {
      console.error(`❌ Project has only ${taskCount} tasks, expected 500`);
      console.error(`Run: node scripts/seed-500-tasks-simple.mjs`);
      await sql.end();
      process.exit(1);
    }

    console.log(`✓ Project has ${taskCount} tasks`);

    // Test 1: Initial page load (first 20 tasks)
    console.log('\n📊 Test 1: Initial page load (first 20 tasks)');
    const startTime1 = Date.now();

    const initialPage = await sql`
      SELECT * FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${EXPECTED_INITIAL_PAGE_SIZE}
    `;

    const loadTime1 = Date.now() - startTime1;

    console.log(`  Load time: ${loadTime1}ms`);
    console.log(`  Tasks returned: ${initialPage.length}`);
    console.log(`  Expected: ${EXPECTED_INITIAL_PAGE_SIZE}`);

    if (initialPage.length !== EXPECTED_INITIAL_PAGE_SIZE) {
      console.error(`  ❌ Expected ${EXPECTED_INITIAL_PAGE_SIZE} tasks, got ${initialPage.length}`);
      await sql.end();
      process.exit(1);
    }

    if (loadTime1 > MAX_LOAD_TIME_MS) {
      console.error(`  ❌ Load time ${loadTime1}ms exceeds target of ${MAX_LOAD_TIME_MS}ms`);
      await sql.end();
      process.exit(1);
    }

    console.log(`  ✅ PASSED: Load time under ${MAX_LOAD_TIME_MS}ms`);
    console.log(`  ✅ PASSED: Pagination returns ${EXPECTED_INITIAL_PAGE_SIZE} tasks`);

    // Test 2: Cached query (should be faster)
    console.log('\n📊 Test 2: Cached query (second load)');
    const startTime2 = Date.now();

    await sql`
      SELECT * FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${EXPECTED_INITIAL_PAGE_SIZE}
    `;

    const loadTime2 = Date.now() - startTime2;
    console.log(`  Load time: ${loadTime2}ms`);
    console.log(`  ✅ Cached query completed`);

    // Test 3: Average load time over 5 runs
    console.log('\n📊 Test 3: Average load time over 5 runs');
    const loadTimes = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await sql`
        SELECT * FROM tasks
        WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT ${EXPECTED_INITIAL_PAGE_SIZE}
      `;
      const time = Date.now() - start;
      loadTimes.push(time);
    }

    const avgLoadTime = Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length);
    const minLoadTime = Math.min(...loadTimes);
    const maxLoadTime = Math.max(...loadTimes);

    console.log(`  Average: ${avgLoadTime}ms`);
    console.log(`  Min: ${minLoadTime}ms`);
    console.log(`  Max: ${maxLoadTime}ms`);

    if (avgLoadTime > MAX_LOAD_TIME_MS) {
      console.error(`  ❌ Average load time ${avgLoadTime}ms exceeds target of ${MAX_LOAD_TIME_MS}ms`);
      await sql.end();
      process.exit(1);
    }

    console.log(`  ✅ PASSED: Average load time under ${MAX_LOAD_TIME_MS}ms`);

    // Test 4: Filtered query performance
    console.log('\n📊 Test 4: Filtered query performance (status filter)');
    const startTime4 = Date.now();

    const filteredTasks = await sql`
      SELECT * FROM tasks
      WHERE project_id = ${projectId} AND status = 'in_progress'
      ORDER BY created_at DESC
      LIMIT ${EXPECTED_INITIAL_PAGE_SIZE}
    `;

    const loadTime4 = Date.now() - startTime4;
    console.log(`  Load time: ${loadTime4}ms`);
    console.log(`  Tasks returned: ${filteredTasks.length}`);

    if (loadTime4 > MAX_LOAD_TIME_MS) {
      console.error(`  ❌ Filtered query ${loadTime4}ms exceeds target of ${MAX_LOAD_TIME_MS}ms`);
      await sql.end();
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
    console.log(`  Average load (5 runs): ${avgLoadTime}ms (range: ${minLoadTime}-${maxLoadTime}ms)`);
    console.log(`  Filtered query: ${loadTime4}ms (target: <${MAX_LOAD_TIME_MS}ms)`);
    console.log(`  Pagination size: ${EXPECTED_INITIAL_PAGE_SIZE} tasks`);
    console.log(`  Total tasks in project: ${taskCount}`);
    console.log('='.repeat(60));

    console.log('\n✅ Task list performance verification: SUCCESS');
    console.log(`✅ Meets acceptance criteria: Task list loads under ${MAX_LOAD_TIME_MS}ms for 500 tasks`);

    await sql.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error verifying task list performance:', error);
    await sql.end();
    process.exit(1);
  }
}

// Get project ID from command line or environment
const projectId = process.argv[2] || process.env.TEST_PROJECT_ID;

if (!projectId) {
  console.error('❌ Project ID required');
  console.error('Usage: node scripts/verify-task-list-performance-simple.mjs [projectId]');
  console.error('  Or set TEST_PROJECT_ID environment variable');
  console.error('\nRun: node scripts/seed-500-tasks-simple.mjs to create a test project');
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
