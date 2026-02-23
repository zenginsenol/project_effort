import 'dotenv/config';

import { db } from './index';
import { sql } from 'drizzle-orm';

/**
 * Performance test script for full-text search
 * Tests search performance with 10,000+ items
 * Acceptance criteria: Results must return within 200ms
 */

interface PerformanceTestResult {
  testName: string;
  query: string;
  duration: number;
  resultCount: number;
  passed: boolean;
  explainAnalyze?: string;
}

const PERFORMANCE_THRESHOLD_MS = 200;
const organizationId = process.argv[2];

if (!organizationId) {
  console.error('❌ Error: Organization ID required');
  console.log('Usage: pnpm test:performance -- <organization-id>');
  console.log('\nGet organization ID from seed-performance output');
  process.exit(1);
}

async function runPerformanceTests(): Promise<void> {
  console.log('🚀 Starting Search Performance Tests');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Organization ID: ${organizationId}`);
  console.log(`Performance Threshold: ${PERFORMANCE_THRESHOLD_MS}ms`);
  console.log('═══════════════════════════════════════════════════\n');

  const results: PerformanceTestResult[] = [];

  // Test 1: Search across all entity types (most common use case)
  console.log('Test 1: Search across all entity types for "API"');
  const test1Start = Date.now();
  const test1Results = await db.execute(sql`
    SELECT 'project' as entity_type, id, name as title, description, ts_rank(search_vector, to_tsquery('english', 'API')) as rank
    FROM projects
    WHERE organization_id = ${organizationId}
      AND search_vector @@ to_tsquery('english', 'API')
    UNION ALL
    SELECT 'task' as entity_type, t.id, t.title, t.description, ts_rank(t.search_vector, to_tsquery('english', 'API')) as rank
    FROM tasks t
    INNER JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ${organizationId}
      AND t.search_vector @@ to_tsquery('english', 'API')
    UNION ALL
    SELECT 'cost_analysis' as entity_type, id, name as title, description, ts_rank(search_vector, to_tsquery('english', 'API')) as rank
    FROM cost_analyses
    WHERE organization_id = ${organizationId}
      AND search_vector @@ to_tsquery('english', 'API')
    UNION ALL
    SELECT 'session' as entity_type, s.id, s.name as title, NULL as description, ts_rank(s.search_vector, to_tsquery('english', 'API')) as rank
    FROM sessions s
    INNER JOIN projects p ON s.project_id = p.id
    WHERE p.organization_id = ${organizationId}
      AND s.search_vector @@ to_tsquery('english', 'API')
    ORDER BY rank DESC
    LIMIT 50
  `);
  const test1Duration = Date.now() - test1Start;
  results.push({
    testName: 'Search all entities for "API"',
    query: 'API',
    duration: test1Duration,
    resultCount: test1Results.rows.length,
    passed: test1Duration < PERFORMANCE_THRESHOLD_MS,
  });
  console.log(`  Duration: ${test1Duration}ms`);
  console.log(`  Results: ${test1Results.rows.length} items`);
  console.log(`  Status: ${test1Duration < PERFORMANCE_THRESHOLD_MS ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 2: Search tasks only (most common filter)
  console.log('Test 2: Search tasks for "authentication"');
  const test2Start = Date.now();
  const test2Results = await db.execute(sql`
    SELECT t.id, t.title, t.description, ts_rank(t.search_vector, to_tsquery('english', 'authentication')) as rank
    FROM tasks t
    INNER JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ${organizationId}
      AND t.search_vector @@ to_tsquery('english', 'authentication')
    ORDER BY rank DESC
    LIMIT 50
  `);
  const test2Duration = Date.now() - test2Start;
  results.push({
    testName: 'Search tasks for "authentication"',
    query: 'authentication',
    duration: test2Duration,
    resultCount: test2Results.rows.length,
    passed: test2Duration < PERFORMANCE_THRESHOLD_MS,
  });
  console.log(`  Duration: ${test2Duration}ms`);
  console.log(`  Results: ${test2Results.rows.length} items`);
  console.log(`  Status: ${test2Duration < PERFORMANCE_THRESHOLD_MS ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 3: Complex multi-word search
  console.log('Test 3: Search for "database migration"');
  const test3Start = Date.now();
  const test3Results = await db.execute(sql`
    SELECT t.id, t.title, t.description, ts_rank(t.search_vector, to_tsquery('english', 'database & migration')) as rank
    FROM tasks t
    INNER JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ${organizationId}
      AND t.search_vector @@ to_tsquery('english', 'database & migration')
    ORDER BY rank DESC
    LIMIT 50
  `);
  const test3Duration = Date.now() - test3Start;
  results.push({
    testName: 'Search for "database migration"',
    query: 'database & migration',
    duration: test3Duration,
    resultCount: test3Results.rows.length,
    passed: test3Duration < PERFORMANCE_THRESHOLD_MS,
  });
  console.log(`  Duration: ${test3Duration}ms`);
  console.log(`  Results: ${test3Results.rows.length} items`);
  console.log(`  Status: ${test3Duration < PERFORMANCE_THRESHOLD_MS ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 4: Search cost analyses
  console.log('Test 4: Search cost analyses for "budget"');
  const test4Start = Date.now();
  const test4Results = await db.execute(sql`
    SELECT id, name, description, ts_rank(search_vector, to_tsquery('english', 'budget')) as rank
    FROM cost_analyses
    WHERE organization_id = ${organizationId}
      AND search_vector @@ to_tsquery('english', 'budget')
    ORDER BY rank DESC
    LIMIT 50
  `);
  const test4Duration = Date.now() - test4Start;
  results.push({
    testName: 'Search cost analyses for "budget"',
    query: 'budget',
    duration: test4Duration,
    resultCount: test4Results.rows.length,
    passed: test4Duration < PERFORMANCE_THRESHOLD_MS,
  });
  console.log(`  Duration: ${test4Duration}ms`);
  console.log(`  Results: ${test4Results.rows.length} items`);
  console.log(`  Status: ${test4Duration < PERFORMANCE_THRESHOLD_MS ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 5: Search sessions
  console.log('Test 5: Search sessions for "planning"');
  const test5Start = Date.now();
  const test5Results = await db.execute(sql`
    SELECT s.id, s.name, ts_rank(s.search_vector, to_tsquery('english', 'planning')) as rank
    FROM sessions s
    INNER JOIN projects p ON s.project_id = p.id
    WHERE p.organization_id = ${organizationId}
      AND s.search_vector @@ to_tsquery('english', 'planning')
    ORDER BY rank DESC
    LIMIT 50
  `);
  const test5Duration = Date.now() - test5Start;
  results.push({
    testName: 'Search sessions for "planning"',
    query: 'planning',
    duration: test5Duration,
    resultCount: test5Results.rows.length,
    passed: test5Duration < PERFORMANCE_THRESHOLD_MS,
  });
  console.log(`  Duration: ${test5Duration}ms`);
  console.log(`  Results: ${test5Results.rows.length} items`);
  console.log(`  Status: ${test5Duration < PERFORMANCE_THRESHOLD_MS ? '✅ PASS' : '❌ FAIL'}\n`);

  // Verify GIN indexes are being used
  console.log('═══════════════════════════════════════════════════');
  console.log('Verifying GIN Index Usage (EXPLAIN ANALYZE)');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Test: EXPLAIN ANALYZE for task search query');
  const explainResult = await db.execute(sql`
    EXPLAIN ANALYZE
    SELECT t.id, t.title, t.description, ts_rank(t.search_vector, to_tsquery('english', 'authentication')) as rank
    FROM tasks t
    INNER JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ${organizationId}
      AND t.search_vector @@ to_tsquery('english', 'authentication')
    ORDER BY rank DESC
    LIMIT 50
  `);

  console.log('Query Plan:');
  explainResult.rows.forEach((row: any) => {
    console.log(`  ${row['QUERY PLAN']}`);
  });

  const queryPlan = explainResult.rows.map((row: any) => row['QUERY PLAN']).join('\n');
  const usingGinIndex = queryPlan.includes('Bitmap Index Scan') && queryPlan.includes('idx_tasks_search_vector');

  console.log(`\n${usingGinIndex ? '✅' : '⚠️'} GIN Index: ${usingGinIndex ? 'BEING USED' : 'NOT DETECTED'}\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('Performance Test Summary');
  console.log('═══════════════════════════════════════════════════\n');

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.testName}`);
    console.log(`     Query: "${result.query}"`);
    console.log(`     Duration: ${result.duration}ms (threshold: ${PERFORMANCE_THRESHOLD_MS}ms)`);
    console.log(`     Results: ${result.resultCount} items\n`);
  });

  console.log('═══════════════════════════════════════════════════');
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);

  if (!usingGinIndex) {
    console.log('⚠️  WARNING: GIN index may not be in use');
    console.log('   Consider running ANALYZE on tables or checking index creation');
  }

  if (passedTests === totalTests && usingGinIndex) {
    console.log('✅ All performance tests PASSED');
    console.log('✅ GIN indexes are being used');
    console.log('✅ Search meets < 200ms requirement');
  } else if (passedTests === totalTests) {
    console.log('✅ All performance tests PASSED');
    console.log('⚠️  However, GIN index usage should be verified');
  } else {
    console.log('❌ Some performance tests FAILED');
    console.log('   Search queries should complete in under 200ms');
  }
  console.log('═══════════════════════════════════════════════════\n');

  // Exit with appropriate code
  process.exit(passedTests === totalTests && usingGinIndex ? 0 : 1);
}

runPerformanceTests().catch((err: unknown) => {
  console.error('❌ Performance test failed:', err);
  process.exit(1);
});
