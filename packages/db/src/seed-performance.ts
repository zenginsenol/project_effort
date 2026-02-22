import 'dotenv/config';

import { db } from './index';
import { organizations } from './schema/organizations';
import { users, organizationMembers } from './schema/users';
import { projects } from './schema/projects';
import { tasks } from './schema/tasks';
import { costAnalyses } from './schema/cost-analyses';
import { sessions } from './schema/sessions';
import { sql } from 'drizzle-orm';

/**
 * Performance testing seed script
 * Seeds database with 10,000+ items to test search performance
 *
 * Distribution:
 * - 100 projects
 * - 8,000 tasks (80 per project)
 * - 1,500 cost analyses (15 per project)
 * - 500 sessions (5 per project)
 * Total: 10,100 searchable items
 */
async function seedPerformanceData(): Promise<void> {
  console.log('🌱 Starting performance data seeding...');
  console.log('Target: 10,000+ searchable items\n');

  const startTime = Date.now();

  // Create organization
  console.log('Creating organization...');
  const [org] = await db.insert(organizations).values({
    name: 'Performance Test Org',
    slug: 'perf-test',
    description: 'Organization for search performance testing with 10,000+ items',
  }).returning();

  if (!org) {
    throw new Error('Failed to create organization');
  }
  console.log(`✓ Organization created: ${org.name} (${org.id})\n`);

  // Create users (10 users for variety)
  console.log('Creating users...');
  const userPromises = Array.from({ length: 10 }, (_, i) =>
    db.insert(users).values({
      clerkId: `perf_user_${i + 1}`,
      email: `perfuser${i + 1}@test.com`,
      firstName: `PerfUser`,
      lastName: `${i + 1}`,
    }).returning()
  );
  const userResults = await Promise.all(userPromises);
  const createdUsers = userResults.map(([user]) => user!);

  // Add all users to organization
  await Promise.all(
    createdUsers.map(user =>
      db.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: 'member',
      })
    )
  );
  console.log(`✓ Created ${createdUsers.length} users\n`);

  // Create 100 projects
  console.log('Creating 100 projects...');
  const projectBatchSize = 10;
  const projectBatches = Math.ceil(100 / projectBatchSize);
  const allProjects: Array<{ id: string; name: string; key: string; organizationId: string }> = [];

  for (let batch = 0; batch < projectBatches; batch++) {
    const batchProjects = Array.from({ length: projectBatchSize }, (_, i) => {
      const projectNum = batch * projectBatchSize + i + 1;
      return {
        organizationId: org.id,
        name: `Performance Test Project ${projectNum}`,
        key: `PERF${projectNum}`,
        description: `This is a test project for performance testing. Project ${projectNum} contains various searchable content including technical terms like API, database, authentication, microservices, REST, GraphQL, TypeScript, React, Node.js, and many more keywords.`,
        status: 'active' as const,
      };
    });

    const batchResults = await db.insert(projects).values(batchProjects).returning();
    allProjects.push(...batchResults);

    if ((batch + 1) % 5 === 0) {
      console.log(`  Progress: ${batch + 1}/${projectBatches} batches (${allProjects.length} projects)`);
    }
  }

  // Update search vectors for projects
  console.log('Updating project search vectors...');
  await db.execute(sql`
    UPDATE projects
    SET search_vector = to_tsvector('english',
      COALESCE(name, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(key, '')
    )
    WHERE organization_id = ${org.id}
  `);
  console.log(`✓ Created ${allProjects.length} projects with search vectors\n`);

  // Create 8,000 tasks (80 per project)
  console.log('Creating 8,000 tasks (80 per project)...');
  const taskBatchSize = 200;
  const totalTasks = 8000;
  const taskBatches = Math.ceil(totalTasks / taskBatchSize);
  let totalTasksCreated = 0;

  const taskStatuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
  const taskPriorities = ['low', 'medium', 'high', 'critical'] as const;
  const taskTypes = ['task', 'bug', 'feature', 'epic'] as const;

  for (let batch = 0; batch < taskBatches; batch++) {
    const batchTasks = Array.from({ length: taskBatchSize }, (_, i) => {
      const taskNum = batch * taskBatchSize + i + 1;
      const projectIndex = Math.floor(taskNum / 80) % allProjects.length;
      const project = allProjects[projectIndex]!;
      const assignee = createdUsers[taskNum % createdUsers.length]!;

      return {
        projectId: project.id,
        title: `Task ${taskNum}: Implement feature ${taskNum % 10 === 0 ? 'authentication' : taskNum % 7 === 0 ? 'database migration' : taskNum % 5 === 0 ? 'API endpoint' : 'component'}`,
        description: `This task involves implementing searchable content with keywords like TypeScript, React, testing, performance, optimization, security, Docker, Kubernetes, CI/CD pipeline, monitoring, logging, error handling. Task number ${taskNum}.`,
        type: taskTypes[taskNum % taskTypes.length]!,
        status: taskStatuses[taskNum % taskStatuses.length]!,
        priority: taskPriorities[taskNum % taskPriorities.length]!,
        assigneeId: assignee.id,
        estimatedPoints: (taskNum % 5) + 1,
        estimatedHours: (taskNum % 8) + 1,
        sortOrder: taskNum,
      };
    });

    await db.insert(tasks).values(batchTasks);
    totalTasksCreated += batchTasks.length;

    if ((batch + 1) % 10 === 0) {
      console.log(`  Progress: ${batch + 1}/${taskBatches} batches (${totalTasksCreated} tasks)`);
    }
  }

  // Update search vectors for tasks
  console.log('Updating task search vectors...');
  await db.execute(sql`
    UPDATE tasks
    SET search_vector = to_tsvector('english',
      COALESCE(title, '') || ' ' ||
      COALESCE(description, '')
    )
    WHERE project_id IN (
      SELECT id FROM projects WHERE organization_id = ${org.id}
    )
  `);
  console.log(`✓ Created ${totalTasksCreated} tasks with search vectors\n`);

  // Create 1,500 cost analyses (15 per project)
  console.log('Creating 1,500 cost analyses (15 per project)...');
  const costAnalysisBatchSize = 150;
  const totalCostAnalyses = 1500;
  const costAnalysisBatches = Math.ceil(totalCostAnalyses / costAnalysisBatchSize);
  let totalCostAnalysesCreated = 0;

  for (let batch = 0; batch < costAnalysisBatches; batch++) {
    const batchCostAnalyses = Array.from({ length: costAnalysisBatchSize }, (_, i) => {
      const analysisNum = batch * costAnalysisBatchSize + i + 1;
      const projectIndex = Math.floor(analysisNum / 15) % allProjects.length;
      const project = allProjects[projectIndex]!;
      const creator = createdUsers[analysisNum % createdUsers.length]!;

      return {
        organizationId: org.id,
        projectId: project.id,
        createdByUserId: creator.id,
        name: `Cost Analysis ${analysisNum}: ${analysisNum % 3 === 0 ? 'Q1 2026' : analysisNum % 3 === 1 ? 'Q2 2026' : 'Annual 2026'}`,
        description: `Cost analysis for performance testing including budget planning, resource allocation, timeline estimation, risk assessment, stakeholder communication. Analysis ${analysisNum} with searchable keywords.`,
        sourceType: 'project_tasks',
        parameters: { hourlyRate: 100, overhead: 0.2, contingency: 0.15 },
        editableSections: { summary: true, breakdown: true, assumptions: true },
        assumptions: { teamSize: 5, sprintLength: 2, velocity: 30 },
        taskSnapshot: { totalTasks: 50, totalPoints: 150 },
        summarySnapshot: { totalHours: 300, totalCost: 30000 },
        breakdownSnapshot: { development: 20000, design: 5000, testing: 5000 },
      };
    });

    await db.insert(costAnalyses).values(batchCostAnalyses);
    totalCostAnalysesCreated += batchCostAnalyses.length;

    if ((batch + 1) % 3 === 0) {
      console.log(`  Progress: ${batch + 1}/${costAnalysisBatches} batches (${totalCostAnalysesCreated} analyses)`);
    }
  }

  // Update search vectors for cost analyses
  console.log('Updating cost analysis search vectors...');
  await db.execute(sql`
    UPDATE cost_analyses
    SET search_vector = to_tsvector('english',
      COALESCE(name, '') || ' ' ||
      COALESCE(description, '')
    )
    WHERE organization_id = ${org.id}
  `);
  console.log(`✓ Created ${totalCostAnalysesCreated} cost analyses with search vectors\n`);

  // Create 500 sessions (5 per project)
  console.log('Creating 500 sessions (5 per project)...');
  const sessionBatchSize = 50;
  const totalSessions = 500;
  const sessionBatches = Math.ceil(totalSessions / sessionBatchSize);
  let totalSessionsCreated = 0;

  const sessionMethods = ['planning_poker', 'pert', 'tshirt_sizing'] as const;
  const sessionStatuses = ['waiting', 'voting', 'completed'] as const;

  for (let batch = 0; batch < sessionBatches; batch++) {
    const batchSessions = Array.from({ length: sessionBatchSize }, (_, i) => {
      const sessionNum = batch * sessionBatchSize + i + 1;
      const projectIndex = Math.floor(sessionNum / 5) % allProjects.length;
      const project = allProjects[projectIndex]!;
      const moderator = createdUsers[sessionNum % createdUsers.length]!;

      return {
        projectId: project.id,
        name: `Estimation Session ${sessionNum}: ${sessionNum % 2 === 0 ? 'Sprint Planning' : 'Backlog Refinement'}`,
        method: sessionMethods[sessionNum % sessionMethods.length]!,
        status: sessionStatuses[sessionNum % sessionStatuses.length]!,
        moderatorId: moderator.id,
        currentRound: sessionNum % 3 + 1,
        finalEstimate: sessionNum % 2 === 0 ? (sessionNum % 10) + 1 : null,
      };
    });

    await db.insert(sessions).values(batchSessions);
    totalSessionsCreated += batchSessions.length;

    if ((batch + 1) % 3 === 0) {
      console.log(`  Progress: ${batch + 1}/${sessionBatches} batches (${totalSessionsCreated} sessions)`);
    }
  }

  // Update search vectors for sessions
  console.log('Updating session search vectors...');
  await db.execute(sql`
    UPDATE sessions
    SET search_vector = to_tsvector('english',
      COALESCE(name, '')
    )
    WHERE project_id IN (
      SELECT id FROM projects WHERE organization_id = ${org.id}
    )
  `);
  console.log(`✓ Created ${totalSessionsCreated} sessions with search vectors\n`);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Performance data seeding complete!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Organization ID: ${org.id}`);
  console.log(`Total searchable items: ${allProjects.length + totalTasksCreated + totalCostAnalysesCreated + totalSessionsCreated}`);
  console.log(`  - Projects: ${allProjects.length}`);
  console.log(`  - Tasks: ${totalTasksCreated}`);
  console.log(`  - Cost Analyses: ${totalCostAnalysesCreated}`);
  console.log(`  - Sessions: ${totalSessionsCreated}`);
  console.log(`Duration: ${duration}s`);
  console.log('═══════════════════════════════════════════════════\n');

  console.log('💡 Run performance tests with:');
  console.log(`   pnpm --filter @estimate-pro/db test:performance -- ${org.id}`);

  process.exit(0);
}

seedPerformanceData().catch((err: unknown) => {
  console.error('❌ Performance seed failed:', err);
  process.exit(1);
});
