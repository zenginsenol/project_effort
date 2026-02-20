#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const now = new Date().toISOString();
const outputPath = path.resolve(root, 'agent-ops/ops/go-live-flow-runner-latest.md');

function argValue(flag) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function safeExec(command, opts = {}) {
  try {
    const output = execSync(command, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      ...opts,
    });
    return { ok: true, output: output.trim(), code: 0 };
  } catch (error) {
    const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout || '') : '';
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || '') : '';
    const code = error && typeof error === 'object' && 'status' in error ? Number(error.status || 1) : 1;
    return {
      ok: false,
      output: `${stdout}\n${stderr}`.trim(),
      code,
    };
  }
}

function parseRoadmapGates() {
  const roadmapPath = path.resolve(root, 'agent-ops/ops/effort-flow-roadmap-latest.md');
  if (!fs.existsSync(roadmapPath)) {
    return [];
  }

  const md = fs.readFileSync(roadmapPath, 'utf8');
  const rows = Array.from(md.matchAll(/^\|\s*(.+?)\s*\|\s*(pass|warn|fail)\s*\|\s*(.+?)\s*\|$/gm));

  return rows
    .filter((row) => row[1] !== 'Gate')
    .map((row) => ({ gate: row[1], status: row[2], evidence: row[3] }));
}

function runStep(id, name, command) {
  const startedAt = Date.now();
  const result = safeExec(command, { maxBuffer: 20 * 1024 * 1024 });
  const durationMs = Date.now() - startedAt;

  return {
    id,
    name,
    command,
    status: result.ok ? 'pass' : 'fail',
    code: result.code,
    durationMs,
    output: result.output,
  };
}

function buildReport(context, steps, gates, transferDecision) {
  const branch = safeExec('git rev-parse --abbrev-ref HEAD').output || 'unknown';
  const commit = safeExec('git rev-parse --short HEAD').output || 'unknown';

  const lines = [];
  lines.push('# Go-Live Flow Runner Report');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Branch: \`${branch}\``);
  lines.push(`Commit: \`${commit}\``);
  lines.push('');

  lines.push('## Execution Context');
  lines.push('');
  lines.push(`- withTransfer: ${context.withTransfer}`);
  lines.push(`- projectId: ${context.projectId || '-'}`);
  lines.push(`- GITHUB_REPO: ${context.githubRepoSet ? 'set' : 'missing'}`);
  lines.push(`- GITHUB_TOKEN: ${context.githubTokenSet ? 'set' : 'missing'}`);
  lines.push(`- KANBAN_PROJECT_ID: ${context.kanbanProjectIdSet ? 'set' : 'missing'}`);
  lines.push('');

  lines.push('## Step Results');
  lines.push('');
  lines.push('| Step | Status | Duration(ms) | Command | Exit |');
  lines.push('|---|---|---|---|---|');
  for (const step of steps) {
    lines.push(`| ${step.id}. ${step.name} | ${step.status} | ${step.durationMs} | \`${step.command}\` | ${step.code} |`);
  }
  lines.push('');

  lines.push('## Transfer Decision');
  lines.push('');
  lines.push(`- status: ${transferDecision.status}`);
  lines.push(`- detail: ${transferDecision.detail}`);
  lines.push('');

  lines.push('## Consolidated Gates (from effort-flow-roadmap)');
  lines.push('');
  if (gates.length === 0) {
    lines.push('- No gate rows found. Ensure `pnpm ops:flow:roadmap` succeeded.');
  } else {
    lines.push('| Gate | Status | Evidence |');
    lines.push('|---|---|---|');
    for (const row of gates) {
      lines.push(`| ${row.gate} | ${row.status} | ${row.evidence} |`);
    }
  }
  lines.push('');

  lines.push('## Next Action Rules');
  lines.push('');
  lines.push('1. Any `fail` step blocks go-live.');
  lines.push('2. `warn` gate on transfer means GitHub/Kanban envs or integration linkage missing.');
  lines.push('3. `warn` gate on AI provider health means provider quota/rate-limit; integration code path still valid.');
  lines.push('');

  const failedSteps = steps.filter((step) => step.status === 'fail');
  if (failedSteps.length > 0) {
    lines.push('## Failed Step Output (truncated)');
    lines.push('');
    for (const step of failedSteps) {
      const snippet = step.output.length > 1500 ? `${step.output.slice(0, 1500)}...` : step.output;
      lines.push(`### ${step.id}. ${step.name}`);
      lines.push('');
      lines.push('```text');
      lines.push(snippet || '(no output)');
      lines.push('```');
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const shouldWrite = hasFlag('--write');
  const withTransfer = hasFlag('--with-transfer');
  const projectId = argValue('--project-id');

  const context = {
    withTransfer,
    projectId,
    githubRepoSet: Boolean(process.env.GITHUB_REPO?.trim()),
    githubTokenSet: Boolean(process.env.GITHUB_TOKEN?.trim()),
    kanbanProjectIdSet: Boolean(process.env.KANBAN_PROJECT_ID?.trim() || projectId),
  };

  const steps = [];
  steps.push(runStep('1', 'Docs Bootstrap', 'pnpm ops:bootstrap:docs'));
  steps.push(runStep('2', 'Integration Contracts', 'pnpm ops:integration:check'));
  steps.push(runStep('3', 'Effort Workflow Check', 'pnpm ops:effort:workflow:check'));
  steps.push(runStep('4', 'Unified Roadmap', 'pnpm ops:flow:roadmap'));

  let transferDecision = { status: 'skipped', detail: 'with-transfer flag not enabled' };

  if (withTransfer) {
    if (!context.githubRepoSet || !context.githubTokenSet) {
      transferDecision = {
        status: 'blocked',
        detail: 'GITHUB_REPO or GITHUB_TOKEN missing',
      };
    } else if (!context.kanbanProjectIdSet) {
      transferDecision = {
        status: 'blocked',
        detail: 'KANBAN_PROJECT_ID missing and --project-id not provided',
      };
    } else {
      const resolvedProjectId = projectId || process.env.KANBAN_PROJECT_ID;
      const command = `pnpm ops:bootstrap:docs:push -- --project-id ${resolvedProjectId}`;
      const transferStep = runStep('5', 'Push GitHub + Kanban', command);
      steps.push(transferStep);
      steps.push(runStep('6', 'Unified Roadmap (post-transfer)', 'pnpm ops:flow:roadmap'));

      transferDecision = transferStep.status === 'pass'
        ? { status: 'executed', detail: 'Transfer command executed successfully' }
        : { status: 'failed', detail: `Transfer command failed (exit=${transferStep.code})` };
    }
  }

  const gates = parseRoadmapGates();
  const report = buildReport(context, steps, gates, transferDecision);
  console.log(report);

  if (shouldWrite) {
    fs.writeFileSync(outputPath, report, 'utf8');
    console.log(`[go-live-flow-runner] wrote ${outputPath}`);
  }

  const hasFailure = steps.some((step) => step.status === 'fail');
  if (hasFailure) {
    process.exit(1);
  }
}

main();
