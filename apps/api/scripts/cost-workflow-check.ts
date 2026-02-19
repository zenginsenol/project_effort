#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, asc, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { apiKeys, projects, users } from '@estimate-pro/db/schema';

import { appRouter } from '../src/routers/index';

type StepResult = {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  detail: string;
};

type CheckState = {
  projectId: string;
  orgId: string;
  userId: string;
  createdAnalysisIds: string[];
  baselineAnalysisId: string | null;
  variantAnalysisId: string | null;
  stepResults: StepResult[];
  activeProviders: Array<'openai' | 'anthropic' | 'openrouter'>;
};

type CliOptions = {
  write: boolean;
  keep: boolean;
  projectId?: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const reportPath = path.resolve(repoRoot, 'agent-ops/ops/cost-workflow-check-latest.md');
const now = new Date().toISOString();

function parseOptions(argv: string[]): CliOptions {
  const write = argv.includes('--write');
  const keep = argv.includes('--keep');
  const projectFlagIndex = argv.indexOf('--project-id');
  const projectId = projectFlagIndex >= 0 ? argv[projectFlagIndex + 1] : undefined;

  return { write, keep, projectId };
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toStepResult(
  id: string,
  name: string,
  status: StepResult['status'],
  detail: string,
): StepResult {
  return { id, name, status, detail };
}

async function resolveContext(options: CliOptions): Promise<{
  projectId: string;
  orgId: string;
  userId: string;
}> {
  const project = options.projectId
    ? await db.query.projects.findFirst({
      columns: {
        id: true,
        organizationId: true,
      },
      where: eq(projects.id, options.projectId),
    })
    : await db.query.projects.findFirst({
      columns: {
        id: true,
        organizationId: true,
      },
      orderBy: [asc(projects.createdAt)],
    });

  if (!project) {
    throw new Error('No project found for workflow check');
  }

  const user = await db.query.users.findFirst({
    columns: {
      clerkId: true,
    },
    orderBy: [asc(users.createdAt)],
  });

  if (!user?.clerkId) {
    throw new Error('No user found for workflow check');
  }

  return {
    projectId: project.id,
    orgId: project.organizationId,
    userId: user.clerkId,
  };
}

async function resolveActiveProviders(userClerkId: string): Promise<Array<'openai' | 'anthropic' | 'openrouter'>> {
  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.clerkId, userClerkId),
  });
  if (!user) {
    return [];
  }

  const keys = await db
    .select({
      provider: apiKeys.provider,
      isActive: apiKeys.isActive,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), eq(apiKeys.isActive, true)));

  const unique = new Set<string>();
  for (const key of keys) {
    unique.add(key.provider);
  }

  return Array.from(unique).filter((provider): provider is 'openai' | 'anthropic' | 'openrouter' => (
    provider === 'openai' || provider === 'anthropic' || provider === 'openrouter'
  ));
}

function createCaller(state: CheckState) {
  return appRouter.createCaller({
    req: {} as never,
    res: {} as never,
    userId: state.userId,
    orgId: state.orgId,
  });
}

async function runCheck(options: CliOptions): Promise<{
  state: CheckState;
  failed: boolean;
}> {
  const context = await resolveContext(options);
  const activeProviders = await resolveActiveProviders(context.userId);

  const state: CheckState = {
    projectId: context.projectId,
    orgId: context.orgId,
    userId: context.userId,
    createdAnalysisIds: [],
    baselineAnalysisId: null,
    variantAnalysisId: null,
    stepResults: [],
    activeProviders,
  };

  const caller = createCaller(state);

  const baseInput = {
    projectId: state.projectId,
    assumptions: ['cost workflow check'],
    parameters: {
      hourlyRate: 150,
      currency: 'TRY',
      contingencyPercent: 20,
      workHoursPerDay: 8,
    },
    editableSections: {
      monthlyInfraOpsCost: 15000,
      annualDomainCost: 1200,
      monthlyMaintenanceHours: 80,
      additionalCosts: [],
    },
  };

  async function execute(
    id: string,
    name: string,
    fn: () => Promise<string>,
    optionsForStep?: { warnOnError?: boolean },
  ) {
    try {
      const detail = await fn();
      state.stepResults.push(toStepResult(id, name, 'pass', detail));
    } catch (error) {
      const detail = normalizeError(error);
      if (optionsForStep?.warnOnError) {
        state.stepResults.push(toStepResult(id, name, 'warn', detail));
        return;
      }
      state.stepResults.push(toStepResult(id, name, 'fail', detail));
      throw error;
    }
  }

  try {
    await execute('1', 'Effort Calculate', async () => {
      const result = await caller.effort.calculate({
        projectId: state.projectId,
        hourlyRate: baseInput.parameters.hourlyRate,
        currency: baseInput.parameters.currency,
        contingencyPercent: baseInput.parameters.contingencyPercent,
        workHoursPerDay: baseInput.parameters.workHoursPerDay,
      });

      return `tasks=${result.summary.totalTasks}, totalHours=${result.summary.totalWithContingency}, totalCost=${result.summary.totalCost}`;
    });

    await execute('2', 'Roadmap Generate', async () => {
      const result = await caller.effort.roadmap({
        projectId: state.projectId,
        contingencyPercent: baseInput.parameters.contingencyPercent,
        workHoursPerDay: baseInput.parameters.workHoursPerDay,
        includeCompleted: false,
      });

      return `phases=${result.phases.length}, totalWeeks=${result.summary.totalWeeks}`;
    });

    await execute('3', 'Save Baseline Analysis', async () => {
      const baseline = await caller.effort.saveCurrentAnalysis({
        ...baseInput,
        name: 'Workflow Check Baseline',
        description: 'auto-generated baseline snapshot',
      });

      state.baselineAnalysisId = baseline.id;
      state.createdAnalysisIds.push(baseline.id);

      return `analysisId=${baseline.id}`;
    });

    await execute('4', 'Save Variant Analysis', async () => {
      const variant = await caller.effort.saveCurrentAnalysis({
        ...baseInput,
        name: 'Workflow Check Variant',
        description: 'auto-generated variant snapshot',
        parameters: {
          ...baseInput.parameters,
          hourlyRate: 220,
          contingencyPercent: 25,
        },
      });

      state.variantAnalysisId = variant.id;
      state.createdAnalysisIds.push(variant.id);

      return `analysisId=${variant.id}`;
    });

    await execute('5', 'List Analyses', async () => {
      const list = await caller.effort.listAnalyses({
        projectId: state.projectId,
      });

      if (!state.baselineAnalysisId || !state.variantAnalysisId) {
        throw new Error('Missing baseline or variant id before list check');
      }

      const ids = new Set(list.map((item) => item.id));
      if (!ids.has(state.baselineAnalysisId) || !ids.has(state.variantAnalysisId)) {
        throw new Error('List output does not include newly created analyses');
      }

      return `listCount=${list.length}`;
    });

    await execute('6', 'Update Analysis', async () => {
      if (!state.baselineAnalysisId) {
        throw new Error('Missing baseline analysis id');
      }

      const updated = await caller.effort.updateAnalysis({
        analysisId: state.baselineAnalysisId,
        name: 'Workflow Check Baseline Updated',
        assumptions: ['cost workflow check', 'updated'],
        editableSections: {
          additionalCosts: [
            {
              label: 'CDN',
              amount: 300,
              frequency: 'monthly',
              note: 'workflow-check',
            },
          ],
        },
      });

      return `updatedFirstYearTotal=${updated.summary.firstYearTotalCost}`;
    });

    await execute('7', 'Compare Analyses', async () => {
      if (!state.baselineAnalysisId || !state.variantAnalysisId) {
        throw new Error('Missing comparison ids');
      }

      const compared = await caller.effort.compareAnalyses({
        projectId: state.projectId,
        analysisIds: [state.baselineAnalysisId, state.variantAnalysisId],
      });

      return `rows=${compared.analyses.length}, baseline=${compared.baselineName}`;
    });

    await execute('8', 'Export Analysis (json/csv/md)', async () => {
      if (!state.baselineAnalysisId) {
        throw new Error('Missing baseline analysis id');
      }

      const json = await caller.effort.exportAnalysis({
        analysisId: state.baselineAnalysisId,
        format: 'json',
      });
      const csv = await caller.effort.exportAnalysis({
        analysisId: state.baselineAnalysisId,
        format: 'csv',
      });
      const md = await caller.effort.exportAnalysis({
        analysisId: state.baselineAnalysisId,
        format: 'md',
      });

      return `json=${json.content.length}B, csv=${csv.content.length}B, md=${md.content.length}B`;
    });

    if (!state.baselineAnalysisId) {
      state.stepResults.push(toStepResult(
        '9',
        'GitHub Sync (optional)',
        'skip',
        'Missing baseline analysis id',
      ));
    } else {
      try {
        const sync = await caller.effort.syncAnalysisToGithub({
          analysisId: state.baselineAnalysisId,
        });
        state.stepResults.push(toStepResult(
          '9',
          'GitHub Sync (optional)',
          'pass',
          `issue=${sync.issueUrl}`,
        ));
      } catch (error) {
        const message = normalizeError(error);
        if (
          message.includes('not connected')
          || message.includes('not linked')
          || message.includes('GitHub integration')
          || message.includes('PRECONDITION_FAILED')
        ) {
          state.stepResults.push(toStepResult(
            '9',
            'GitHub Sync (optional)',
            'skip',
            message,
          ));
        } else {
          state.stepResults.push(toStepResult(
            '9',
            'GitHub Sync (optional)',
            'warn',
            message,
          ));
        }
      }
    }

    if (state.activeProviders.length === 0) {
      state.stepResults.push(toStepResult(
        '10',
        'AI Analysis (Settings Provider Model)',
        'skip',
        'No active provider configured in settings',
      ));
    } else {
      for (const provider of state.activeProviders) {
        await execute(
          `10-${provider}`,
          `AI Analysis (${provider})`,
          async () => {
            const ai = await caller.effort.createAiAnalysis({
              ...baseInput,
              name: `Workflow Check AI ${provider}`,
              description: 'auto-generated ai snapshot',
              text: 'Build an internal task management SaaS with auth, kanban, reporting, and github sync.',
              provider,
            });

            state.createdAnalysisIds.push(ai.id);
            return `analysisId=${ai.id}, source=${ai.source.provider}/${ai.source.model ?? 'default'}`;
          },
          { warnOnError: true },
        );
      }
    }
  } finally {
    if (!options.keep && state.createdAnalysisIds.length > 0) {
      for (const id of state.createdAnalysisIds) {
        try {
          await caller.effort.deleteAnalysis({ analysisId: id });
        } catch {
          // cleanup is best effort
        }
      }
    }
  }

  const failed = state.stepResults.some((step) => step.status === 'fail');
  return { state, failed };
}

function buildReport(state: CheckState): string {
  const failed = state.stepResults.filter((step) => step.status === 'fail').length;
  const warned = state.stepResults.filter((step) => step.status === 'warn').length;
  const passed = state.stepResults.filter((step) => step.status === 'pass').length;
  const skipped = state.stepResults.filter((step) => step.status === 'skip').length;

  const lines: string[] = [];
  lines.push('# Cost Workflow Check');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Project: \`${state.projectId}\``);
  lines.push(`Org: \`${state.orgId}\``);
  lines.push(`User: \`${state.userId}\``);
  lines.push(`Active providers: ${state.activeProviders.length > 0 ? state.activeProviders.join(', ') : 'none'}`);
  lines.push(`Result summary: pass=${passed}, warn=${warned}, skip=${skipped}, fail=${failed}`);
  lines.push('');
  lines.push('## Step Results');
  lines.push('');
  lines.push('| Step | Name | Status | Detail |');
  lines.push('|---|---|---|---|');
  for (const step of state.stepResults) {
    lines.push(`| ${step.id} | ${step.name} | ${step.status} | ${step.detail.replaceAll('\n', ' ')} |`);
  }
  lines.push('');
  lines.push('## Process Checklist');
  lines.push('');
  lines.push('1. Effort calculation');
  lines.push('2. Roadmap generation');
  lines.push('3. Baseline + variant analysis save');
  lines.push('4. Analysis update');
  lines.push('5. Analysis compare');
  lines.push('6. Export formats');
  lines.push('7. GitHub sync (optional, requires active integration + linked repo)');
  lines.push('8. AI analysis with active settings profile (provider/model/effort)');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const { state, failed } = await runCheck(options);
  const report = buildReport(state);

  console.log(report);

  if (options.write) {
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`[cost-workflow-check] wrote ${reportPath}`);
  }

  if (failed) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(`[cost-workflow-check] failed: ${normalizeError(error)}`);
  process.exit(1);
});
