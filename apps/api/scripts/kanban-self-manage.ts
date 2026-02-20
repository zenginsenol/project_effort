#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, asc, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { organizations, projects, tasks, users } from '@estimate-pro/db/schema';

import { appRouter } from '../src/routers/index';

type StepStatus = 'pass' | 'fail';

type StepResult = {
  id: string;
  name: string;
  status: StepStatus;
  detail: string;
  durationMs: number;
};

type CliOptions = {
  write: boolean;
  projectId?: string;
  projectName: string;
  projectKey: string;
  description?: string;
  hourlyRate: number;
  contingencyPercent: number;
  workHoursPerDay: number;
  includeCompleted: boolean;
  autoMoveFirstWeekToTodo: boolean;
};

type Context = {
  orgId: string;
  userId: string;
  projectId: string;
  createdProject: boolean;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const reportPath = path.resolve(repoRoot, 'agent-ops/ops/kanban-self-manage-latest.md');

function argValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return undefined;
  return value;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeKey(input: string): string {
  const normalized = input
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 10);
  if (normalized.length < 2) {
    return 'KANBAN';
  }
  return normalized;
}

function parseOptions(): CliOptions {
  return {
    write: hasFlag('--write'),
    projectId: argValue('--project-id'),
    projectName: argValue('--project-name') ?? 'Kanban Effort Workspace',
    projectKey: normalizeKey(argValue('--project-key') ?? 'KANBAN'),
    description: argValue('--description') ?? 'Docs tabanli efor ve proje yonetimi kanban calisma alani',
    hourlyRate: toNumber(argValue('--hourly-rate'), 1200),
    contingencyPercent: toNumber(argValue('--contingency-percent'), 20),
    workHoursPerDay: toNumber(argValue('--work-hours-per-day'), 8),
    includeCompleted: hasFlag('--include-completed'),
    autoMoveFirstWeekToTodo: !hasFlag('--disable-auto-first-week'),
  };
}

function safeExec(command: string): { ok: boolean; output: string; code: number } {
  try {
    const output = execSync(command, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 40 * 1024 * 1024,
    }).trim();
    return { ok: true, output, code: 0 };
  } catch (error) {
    const stdout = error instanceof Error && 'stdout' in error ? String(error.stdout || '') : '';
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr || '') : '';
    const code = error instanceof Error && 'status' in error ? Number(error.status || 1) : 1;
    return { ok: false, output: `${stdout}\n${stderr}`.trim(), code };
  }
}

async function resolveContext(options: CliOptions): Promise<Context> {
  const org = await db.query.organizations.findFirst({
    columns: { id: true, name: true },
    orderBy: [asc(organizations.createdAt)],
  });

  if (!org) {
    throw new Error('No organization found');
  }

  const user = await db.query.users.findFirst({
    columns: { clerkId: true },
    orderBy: [asc(users.createdAt)],
  });

  if (!user?.clerkId) {
    throw new Error('No user found');
  }

  if (options.projectId) {
    const byId = await db.query.projects.findFirst({
      columns: { id: true, organizationId: true },
      where: and(eq(projects.id, options.projectId), eq(projects.organizationId, org.id)),
    });

    if (!byId) {
      throw new Error(`Project not found for organization: ${options.projectId}`);
    }

    return {
      orgId: org.id,
      userId: user.clerkId,
      projectId: byId.id,
      createdProject: false,
    };
  }

  const byKey = await db.query.projects.findFirst({
    columns: { id: true },
    where: and(eq(projects.organizationId, org.id), eq(projects.key, options.projectKey)),
    orderBy: [asc(projects.createdAt)],
  });

  if (byKey) {
    return {
      orgId: org.id,
      userId: user.clerkId,
      projectId: byKey.id,
      createdProject: false,
    };
  }

  const [created] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      name: options.projectName,
      key: options.projectKey,
      description: options.description,
      defaultEstimationMethod: 'planning_poker',
      status: 'active',
    })
    .returning({ id: projects.id });

  if (!created?.id) {
    throw new Error('Failed to create project for kanban workspace');
  }

  return {
    orgId: org.id,
    userId: user.clerkId,
    projectId: created.id,
    createdProject: true,
  };
}

function createCaller(ctx: Context) {
  return appRouter.createCaller({
    req: {} as never,
    res: {} as never,
    userId: ctx.userId,
    orgId: ctx.orgId,
  });
}

async function getBoardSummary(projectId: string) {
  const items = await db.query.tasks.findMany({
    columns: {
      id: true,
      status: true,
      estimatedHours: true,
      estimatedPoints: true,
    },
    where: eq(tasks.projectId, projectId),
  });

  const byStatus = new Map<string, { count: number; hours: number; points: number }>();
  let totalHours = 0;
  let totalPoints = 0;

  for (const item of items) {
    const status = item.status;
    if (!byStatus.has(status)) {
      byStatus.set(status, { count: 0, hours: 0, points: 0 });
    }

    const row = byStatus.get(status);
    if (!row) continue;

    row.count += 1;
    row.hours += item.estimatedHours ?? 0;
    row.points += item.estimatedPoints ?? 0;

    totalHours += item.estimatedHours ?? 0;
    totalPoints += item.estimatedPoints ?? 0;
  }

  const orderedStatuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];

  return {
    taskCount: items.length,
    totalHours: Number(totalHours.toFixed(1)),
    totalPoints: Number(totalPoints.toFixed(1)),
    byStatus: orderedStatuses.map((status) => ({
      status,
      count: byStatus.get(status)?.count ?? 0,
      hours: Number((byStatus.get(status)?.hours ?? 0).toFixed(1)),
      points: Number((byStatus.get(status)?.points ?? 0).toFixed(1)),
    })),
  };
}

function buildReport(params: {
  options: CliOptions;
  context: Context;
  steps: StepResult[];
  board: Awaited<ReturnType<typeof getBoardSummary>>;
  effortCost: number;
  roadmapWeeks: number;
  roadmapPhases: number;
}): string {
  const { options, context, steps, board, effortCost, roadmapWeeks, roadmapPhases } = params;
  const now = new Date().toISOString();
  const branch = safeExec('git rev-parse --abbrev-ref HEAD').output || 'unknown';
  const commit = safeExec('git rev-parse --short HEAD').output || 'unknown';

  const lines: string[] = [];
  lines.push('# Kanban Self-Management Report');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Branch: \`${branch}\``);
  lines.push(`Commit: \`${commit}\``);
  lines.push('');

  lines.push('## Workspace Context');
  lines.push('');
  lines.push(`- Organization: \`${context.orgId}\``);
  lines.push(`- User: \`${context.userId}\``);
  lines.push(`- Project: \`${context.projectId}\``);
  lines.push(`- Created project in this run: ${context.createdProject ? 'yes' : 'no'}`);
  lines.push(`- Hourly rate: ${options.hourlyRate}`);
  lines.push(`- Contingency: ${options.contingencyPercent}%`);
  lines.push(`- Work hours/day: ${options.workHoursPerDay}`);
  lines.push('');

  lines.push('## Step Results');
  lines.push('');
  lines.push('| Step | Status | Duration(ms) | Detail |');
  lines.push('|---|---|---|---|');
  for (const step of steps) {
    lines.push(`| ${step.id}. ${step.name} | ${step.status} | ${step.durationMs} | ${step.detail.replaceAll('\n', ' ')} |`);
  }
  lines.push('');

  lines.push('## Kanban + Effort Summary');
  lines.push('');
  lines.push(`- Total tasks: ${board.taskCount}`);
  lines.push(`- Total estimated hours: ${board.totalHours}h`);
  lines.push(`- Total estimated points: ${board.totalPoints}`);
  lines.push(`- Development cost (rate based): ${effortCost} TRY`);
  lines.push(`- Roadmap: ${roadmapPhases} phase(s), ${roadmapWeeks} week(s)`);
  lines.push('');

  lines.push('| Status | Tasks | Hours | Points |');
  lines.push('|---|---|---|---|');
  for (const row of board.byStatus) {
    lines.push(`| ${row.status} | ${row.count} | ${row.hours} | ${row.points} |`);
  }
  lines.push('');

  lines.push('## How To Use');
  lines.push('');
  lines.push('1. Open `/dashboard/projects/<PROJECT_ID>?view=board` for Kanban execution.');
  lines.push('2. Open `/dashboard/effort` and select the same project for cost/compare/export workflows.');
  lines.push('3. Re-run this script whenever kickoff docs change to refresh backlog + effort baseline.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseOptions();
  const steps: StepResult[] = [];

  const context = await resolveContext(options);
  const caller = createCaller(context);

  let effortCost = 0;
  let roadmapWeeks = 0;
  let roadmapPhases = 0;

  async function step(id: string, name: string, fn: () => Promise<string>) {
    const startedAt = Date.now();
    try {
      const detail = await fn();
      steps.push({
        id,
        name,
        status: 'pass',
        detail,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      steps.push({
        id,
        name,
        status: 'fail',
        detail,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  await step('1', 'Docs Bootstrap -> Kanban import', async () => {
    const command = `node apps/api/scripts/bootstrap-from-docs.mjs --write --push-kanban --project-id ${context.projectId}`;
    const run = safeExec(command);
    if (!run.ok) {
      throw new Error(`Bootstrap failed (exit=${run.code})`);
    }

    const reportFile = path.resolve(repoRoot, 'agent-ops/bootstrap/docs-bootstrap-report-latest.md');
    const report = fs.existsSync(reportFile) ? fs.readFileSync(reportFile, 'utf8') : '';
    const kanbanLine = report
      .split('\n')
      .find((line) => line.startsWith('- Kanban:'))
      ?? 'Kanban line not found';

    return kanbanLine;
  });

  await step('2', 'Effort Calculate', async () => {
    const result = await caller.effort.calculate({
      projectId: context.projectId,
      hourlyRate: options.hourlyRate,
      currency: 'TRY',
      contingencyPercent: options.contingencyPercent,
      workHoursPerDay: options.workHoursPerDay,
    });

    effortCost = result.summary.totalCost;
    return `tasks=${result.summary.totalTasks}, totalHours=${result.summary.totalWithContingency}, cost=${result.summary.totalCost}`;
  });

  await step('3', 'Roadmap Generate', async () => {
    const result = await caller.effort.roadmap({
      projectId: context.projectId,
      contingencyPercent: options.contingencyPercent,
      workHoursPerDay: options.workHoursPerDay,
      includeCompleted: options.includeCompleted,
    });

    roadmapPhases = result.phases.length;
    roadmapWeeks = result.summary.totalWeeks;
    return `phases=${result.phases.length}, weeks=${result.summary.totalWeeks}`;
  });

  await step('4', 'Apply Roadmap to Kanban', async () => {
    const result = await caller.effort.applyRoadmap({
      projectId: context.projectId,
      contingencyPercent: options.contingencyPercent,
      workHoursPerDay: options.workHoursPerDay,
      includeCompleted: options.includeCompleted,
      autoMoveFirstWeekToTodo: options.autoMoveFirstWeekToTodo,
    });

    return `updated=${result.updatedCount}, movedTodo=${result.movedToTodo}, movedBacklog=${result.movedToBacklog}`;
  });

  await step('5', 'Save Baseline Cost Analysis', async () => {
    const saved = await caller.effort.saveCurrentAnalysis({
      projectId: context.projectId,
      name: 'Kanban Workspace Baseline',
      description: 'auto-generated baseline from docs bootstrap + roadmap apply',
      assumptions: ['kanban self-manage baseline'],
      parameters: {
        hourlyRate: options.hourlyRate,
        currency: 'TRY',
        contingencyPercent: options.contingencyPercent,
        workHoursPerDay: options.workHoursPerDay,
      },
      editableSections: {
        monthlyInfraOpsCost: 15000,
        annualDomainCost: 1200,
        monthlyMaintenanceHours: 60,
        additionalCosts: [],
      },
    });

    return `analysisId=${saved.id}`;
  });

  const board = await getBoardSummary(context.projectId);
  const report = buildReport({
    options,
    context,
    steps,
    board,
    effortCost,
    roadmapWeeks,
    roadmapPhases,
  });

  console.log(report);

  if (options.write) {
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`[kanban-self-manage] wrote ${reportPath}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('[kanban-self-manage] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
