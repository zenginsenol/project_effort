#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, asc, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { apiKeys, organizations, projects, tasks, users } from '@estimate-pro/db/schema';

import { appRouter } from '../src/routers/index';

type StepStatus = 'pass' | 'fail' | 'warn' | 'skip';

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
  skipAi: boolean;
  skipGithubSync: boolean;
};

type Context = {
  orgId: string;
  userId: string;
  userDbId: string;
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
    skipAi: hasFlag('--skip-ai'),
    skipGithubSync: hasFlag('--skip-github-sync'),
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

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function resolveContext(options: CliOptions): Promise<Context> {
  const org = await db.query.organizations.findFirst({
    columns: { id: true },
    orderBy: [asc(organizations.createdAt)],
  });

  if (!org) {
    throw new Error('No organization found');
  }

  const user = await db.query.users.findFirst({
    columns: {
      id: true,
      clerkId: true,
    },
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
      userDbId: user.id,
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
      userDbId: user.id,
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
    userDbId: user.id,
    projectId: created.id,
    createdProject: true,
  };
}

async function resolveActiveProviders(userDbId: string): Promise<Array<'openai' | 'anthropic' | 'openrouter'>> {
  const rows = await db
    .select({
      provider: apiKeys.provider,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userDbId), eq(apiKeys.isActive, true)));

  const unique = new Set<string>();
  for (const row of rows) {
    unique.add(row.provider);
  }

  return Array.from(unique).filter((provider): provider is 'openai' | 'anthropic' | 'openrouter' => (
    provider === 'openai' || provider === 'anthropic' || provider === 'openrouter'
  ));
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
  baselineAnalysisId: string | null;
  variantAnalysisId: string | null;
  activeProviders: Array<'openai' | 'anthropic' | 'openrouter'>;
}): string {
  const {
    options,
    context,
    steps,
    board,
    effortCost,
    roadmapWeeks,
    roadmapPhases,
    baselineAnalysisId,
    variantAnalysisId,
    activeProviders,
  } = params;

  const now = new Date().toISOString();
  const branch = safeExec('git rev-parse --abbrev-ref HEAD').output || 'unknown';
  const commit = safeExec('git rev-parse --short HEAD').output || 'unknown';

  const pass = steps.filter((step) => step.status === 'pass').length;
  const warn = steps.filter((step) => step.status === 'warn').length;
  const skip = steps.filter((step) => step.status === 'skip').length;
  const fail = steps.filter((step) => step.status === 'fail').length;

  const lines: string[] = [];
  lines.push('# Kanban Self-Management Report (Full Flow)');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Branch: \`${branch}\``);
  lines.push(`Commit: \`${commit}\``);
  lines.push(`Result summary: pass=${pass}, warn=${warn}, skip=${skip}, fail=${fail}`);
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
  lines.push(`- Active providers: ${activeProviders.length > 0 ? activeProviders.join(', ') : 'none'}`);
  lines.push(`- Baseline analysis id: ${baselineAnalysisId ?? '-'}`);
  lines.push(`- Variant analysis id: ${variantAnalysisId ?? '-'}`);
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

  lines.push('## Full-Flow Checklist');
  lines.push('');
  lines.push('1. Docs -> Kanban import');
  lines.push('2. Effort calculate + roadmap generate + apply');
  lines.push('3. Baseline + variant analysis save');
  lines.push('4. Compare analyses');
  lines.push('5. Export analysis (json/csv/md)');
  lines.push('6. GitHub sync (optional)');
  lines.push('7. AI analysis (optional per active provider)');
  lines.push('');

  lines.push('## How To Use');
  lines.push('');
  lines.push('1. Open `/dashboard/projects/<PROJECT_ID>?view=board` for Kanban execution.');
  lines.push('2. Open `/dashboard/effort` and select the same project for compare/export/sync workflows.');
  lines.push('3. Re-run this command after doc changes: `pnpm ops:kanban:self-manage`.');
  lines.push('4. Optional flags: `--skip-ai`, `--skip-github-sync`, `--project-id <id>`.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseOptions();
  const steps: StepResult[] = [];

  const context = await resolveContext(options);
  const activeProviders = await resolveActiveProviders(context.userDbId);
  const caller = createCaller(context);

  let effortCost = 0;
  let roadmapWeeks = 0;
  let roadmapPhases = 0;
  let baselineAnalysisId: string | null = null;
  let variantAnalysisId: string | null = null;

  async function requiredStep(id: string, name: string, fn: () => Promise<string>) {
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
      const detail = normalizeError(error);
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

  async function optionalStep(id: string, name: string, fn: () => Promise<string>, mode?: 'warn' | 'skip') {
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
      const detail = normalizeError(error);
      steps.push({
        id,
        name,
        status: mode ?? 'warn',
        detail,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  await requiredStep('1', 'Docs Bootstrap -> Kanban import', async () => {
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

  await requiredStep('2', 'Effort Calculate', async () => {
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

  await requiredStep('3', 'Roadmap Generate', async () => {
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

  await requiredStep('4', 'Apply Roadmap to Kanban', async () => {
    const result = await caller.effort.applyRoadmap({
      projectId: context.projectId,
      contingencyPercent: options.contingencyPercent,
      workHoursPerDay: options.workHoursPerDay,
      includeCompleted: options.includeCompleted,
      autoMoveFirstWeekToTodo: options.autoMoveFirstWeekToTodo,
    });

    return `updated=${result.updatedCount}, movedTodo=${result.movedToTodo}, movedBacklog=${result.movedToBacklog}`;
  });

  await requiredStep('5', 'Save Baseline Cost Analysis', async () => {
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

    baselineAnalysisId = saved.id;
    return `analysisId=${saved.id}`;
  });

  await requiredStep('6', 'Save Variant Cost Analysis', async () => {
    const saved = await caller.effort.saveCurrentAnalysis({
      projectId: context.projectId,
      name: 'Kanban Workspace Variant',
      description: 'variant scenario for compare dashboard',
      assumptions: ['kanban self-manage variant'],
      parameters: {
        hourlyRate: options.hourlyRate + 250,
        currency: 'TRY',
        contingencyPercent: options.contingencyPercent + 5,
        workHoursPerDay: options.workHoursPerDay,
      },
      editableSections: {
        monthlyInfraOpsCost: 22000,
        annualDomainCost: 1800,
        monthlyMaintenanceHours: 80,
        additionalCosts: [
          {
            label: 'Monitoring Suite',
            amount: 3000,
            frequency: 'monthly',
            note: 'variant scenario',
          },
        ],
      },
    });

    variantAnalysisId = saved.id;
    return `analysisId=${saved.id}`;
  });

  await requiredStep('7', 'Compare Baseline vs Variant', async () => {
    if (!baselineAnalysisId || !variantAnalysisId) {
      throw new Error('Missing baseline or variant analysis id');
    }

    const compared = await caller.effort.compareAnalyses({
      projectId: context.projectId,
      analysisIds: [baselineAnalysisId, variantAnalysisId],
    });

    return `rows=${compared.analyses.length}, baseline=${compared.baselineName}`;
  });

  await requiredStep('8', 'Export Baseline (json/csv/md)', async () => {
    if (!baselineAnalysisId) {
      throw new Error('Missing baseline analysis id');
    }

    const json = await caller.effort.exportAnalysis({
      analysisId: baselineAnalysisId,
      format: 'json',
    });
    const csv = await caller.effort.exportAnalysis({
      analysisId: baselineAnalysisId,
      format: 'csv',
    });
    const md = await caller.effort.exportAnalysis({
      analysisId: baselineAnalysisId,
      format: 'md',
    });

    return `json=${json.content.length}B, csv=${csv.content.length}B, md=${md.content.length}B`;
  });

  if (options.skipGithubSync) {
    steps.push({
      id: '9',
      name: 'GitHub Sync (optional)',
      status: 'skip',
      detail: 'Skipped by --skip-github-sync',
      durationMs: 0,
    });
  } else {
    await optionalStep('9', 'GitHub Sync (optional)', async () => {
      if (!baselineAnalysisId) {
        throw new Error('Missing baseline analysis id');
      }

      const synced = await caller.effort.syncAnalysisToGithub({
        analysisId: baselineAnalysisId,
      });

      return `issue=${synced.issueUrl}`;
    }, 'warn');

    const last = steps.at(-1);
    if (last?.id === '9' && last.status === 'warn') {
      const message = last.detail.toLowerCase();
      if (
        message.includes('not connected')
        || message.includes('not linked')
        || message.includes('github integration')
        || message.includes('precondition_failed')
      ) {
        last.status = 'skip';
      }
    }
  }

  if (options.skipAi) {
    steps.push({
      id: '10',
      name: 'AI Analysis (optional)',
      status: 'skip',
      detail: 'Skipped by --skip-ai',
      durationMs: 0,
    });
  } else if (activeProviders.length === 0) {
    steps.push({
      id: '10',
      name: 'AI Analysis (optional)',
      status: 'skip',
      detail: 'No active provider in settings',
      durationMs: 0,
    });
  } else {
    for (const provider of activeProviders) {
      await optionalStep(`10-${provider}`, `AI Analysis (${provider})`, async () => {
        const created = await caller.effort.createAiAnalysis({
          projectId: context.projectId,
          name: `Kanban Workspace AI ${provider}`,
          description: 'AI variant from internal kanban flow',
          assumptions: ['ai variant'],
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
          text: 'Build an integrated product delivery platform with kanban planning, effort cost analysis, compare dashboard, and github sync.',
          provider,
        });

        return `analysisId=${created.id}, source=${created.source.provider}/${created.source.model ?? 'default'}`;
      }, 'warn');
    }
  }

  const board = await getBoardSummary(context.projectId);
  const report = buildReport({
    options,
    context,
    steps,
    board,
    effortCost,
    roadmapWeeks,
    roadmapPhases,
    baselineAnalysisId,
    variantAnalysisId,
    activeProviders,
  });

  console.log(report);

  if (options.write) {
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`[kanban-self-manage] wrote ${reportPath}`);
  }

  const hasFail = steps.some((step) => step.status === 'fail');
  if (hasFail) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('[kanban-self-manage] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
