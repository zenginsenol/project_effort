#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { execSync } from 'node:child_process';

const root = process.cwd();
const now = new Date().toISOString();

const outputPath = path.resolve(root, 'agent-ops/ops/effort-flow-roadmap-latest.md');
const bootstrapPath = path.resolve(root, 'agent-ops/bootstrap/docs-bootstrap-analysis-latest.json');
const costCheckPath = path.resolve(root, 'agent-ops/ops/cost-workflow-check-latest.md');
const integrationPath = path.resolve(root, 'agent-ops/ops/module-integration-check-latest.md');
const agentNextPath = path.resolve(root, 'agent-ops/agent-next-tasks.md');

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  const raw = readText(filePath);
  return JSON.parse(raw);
}

function safeExec(command) {
  try {
    return execSync(command, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function parseCostSummary(markdown) {
  const summary = markdown.match(/Result summary:\s*pass=(\d+),\s*warn=(\d+),\s*skip=(\d+),\s*fail=(\d+)/i);

  const stepGithub = markdown.match(/\|\s*9\s*\|\s*GitHub Sync \(optional\)\s*\|\s*(\w+)\s*\|\s*(.*?)\s*\|/i);
  const stepAi = markdown.match(/\|\s*10-[^|]+\|\s*AI Analysis \([^)]+\)\s*\|\s*(\w+)\s*\|\s*(.*?)\s*\|/i);

  return {
    pass: summary ? Number(summary[1]) : 0,
    warn: summary ? Number(summary[2]) : 0,
    skip: summary ? Number(summary[3]) : 0,
    fail: summary ? Number(summary[4]) : 1,
    githubStep: {
      status: stepGithub ? stepGithub[1].toLowerCase() : 'unknown',
      detail: stepGithub ? stepGithub[2] : 'not found',
    },
    aiStep: {
      status: stepAi ? stepAi[1].toLowerCase() : 'unknown',
      detail: stepAi ? stepAi[2] : 'not found',
    },
  };
}

function parseIntegrationSummary(markdown) {
  const summary = markdown.match(/Contract checks:\s*(\d+)\/(\d+)\s+passed/i);
  return {
    passed: summary ? Number(summary[1]) : 0,
    total: summary ? Number(summary[2]) : 0,
  };
}

function parseAgentSummary(markdown) {
  const summary = markdown.match(/Summary:\s*todo=(\d+),\s*in_progress=(\d+),\s*blocked=(\d+),\s*done=(\d+)/i);
  const ownerRows = Array.from(markdown.matchAll(/\|\s*(Agent-[ABC]|QA|Ops|Manager)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/g));

  return {
    todo: summary ? Number(summary[1]) : 0,
    inProgress: summary ? Number(summary[2]) : 0,
    blocked: summary ? Number(summary[3]) : 0,
    done: summary ? Number(summary[4]) : 0,
    ownerRows: ownerRows.map((row) => ({
      owner: row[1],
      active: row[2],
      next: row[3],
    })),
  };
}

function statusLabel(condition, warn = false) {
  if (condition) return 'pass';
  return warn ? 'warn' : 'fail';
}

function buildSectionAggregation(tasks, hourlyRate, contingencyPercent) {
  const grouped = new Map();

  for (const task of tasks) {
    const section = task.section || 'Uncategorized';
    const hours = Number(task.estimatedHours || 0);

    if (!grouped.has(section)) {
      grouped.set(section, { section, taskCount: 0, hours: 0 });
    }

    const row = grouped.get(section);
    row.taskCount += 1;
    row.hours += hours;
  }

  const multiplier = 1 + (contingencyPercent / 100);

  return Array.from(grouped.values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10)
    .map((row) => ({
      ...row,
      costWithContingency: Math.round(row.hours * hourlyRate * multiplier),
    }));
}

function buildReport(data) {
  const branch = safeExec('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const commit = safeExec('git rev-parse --short HEAD') || 'unknown';

  const cos = data.bootstrap.cos;
  const sectionRows = buildSectionAggregation(
    data.bootstrap.tasks,
    cos.cost.hourlyRate,
    cos.effort.contingencyPercent,
  );

  const docsGate = statusLabel(cos.tasksGenerated > 0);
  const workflowGate = statusLabel(data.cost.fail === 0);
  const contractsGate = statusLabel(data.integration.total > 0 && data.integration.passed === data.integration.total);
  const syncReady = data.bootstrap.github.mode !== 'skipped' && data.bootstrap.kanban.mode !== 'skipped';
  const transferGate = statusLabel(syncReady, true);
  const aiHealthy = data.cost.aiStep.status === 'pass';
  const aiGate = statusLabel(aiHealthy, true);

  const blockers = [];
  if (data.bootstrap.github.mode === 'skipped') {
    blockers.push(`GitHub aktarimi hazir degil: ${data.bootstrap.github.reason || 'unknown reason'}`);
  }
  if (data.bootstrap.kanban.mode === 'skipped') {
    blockers.push(`Kanban aktarimi hazir degil: ${data.bootstrap.kanban.reason || 'unknown reason'}`);
  }
  if (data.cost.aiStep.status === 'warn') {
    blockers.push(`AI analizde uyari var: ${data.cost.aiStep.detail}`);
  }
  if (data.cost.fail > 0) {
    blockers.push('Cost workflow check fail adimi var; go-live oncesi zorunlu duzeltme gerekir.');
  }

  const lines = [];
  lines.push('# Effort Flow Roadmap (Live Readiness)');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Branch: \`${branch}\``);
  lines.push(`Commit: \`${commit}\``);
  lines.push('');

  lines.push('## Gate Summary');
  lines.push('');
  lines.push('| Gate | Status | Evidence |');
  lines.push('|---|---|---|');
  lines.push(`| Docs -> COS extraction | ${docsGate} | tasks=${cos.tasksGenerated}, effort=${cos.effort.totalWithContingency}h |`);
  lines.push(`| Effort/Cost workflow | ${workflowGate} | pass=${data.cost.pass}, warn=${data.cost.warn}, skip=${data.cost.skip}, fail=${data.cost.fail} |`);
  lines.push(`| Module contracts | ${contractsGate} | ${data.integration.passed}/${data.integration.total} passed |`);
  lines.push(`| GitHub + Kanban transfer readiness | ${transferGate} | github=${data.bootstrap.github.mode}, kanban=${data.bootstrap.kanban.mode} |`);
  lines.push(`| AI provider health | ${aiGate} | ${data.cost.aiStep.status}: ${data.cost.aiStep.detail} |`);
  lines.push('');

  lines.push('## COS Effort Baseline');
  lines.push('');
  lines.push(`- Documents analyzed: ${cos.documentsAnalyzed}`);
  lines.push(`- Tasks generated: ${cos.tasksGenerated}`);
  lines.push(`- Base effort: ${cos.effort.totalHours}h`);
  lines.push(`- Contingency: ${cos.effort.contingencyPercent}% (${cos.effort.contingencyHours}h)`);
  lines.push(`- Total effort (with contingency): ${cos.effort.totalWithContingency}h`);
  lines.push(`- Development cost: ${cos.cost.developmentCost} ${cos.cost.currency} (hourly=${cos.cost.hourlyRate})`);
  lines.push(`- Monthly infra alternatives (TRY): starter=${cos.operationalCostAlternativesMonthlyTRY.starter}, growth=${cos.operationalCostAlternativesMonthlyTRY.growth}, scale=${cos.operationalCostAlternativesMonthlyTRY.scale}`);
  lines.push('');

  lines.push('## Top Scope Buckets (Roadmap)');
  lines.push('');
  lines.push('| Section | Tasks | Hours | Cost w/ Contingency (TRY) |');
  lines.push('|---|---|---|---|');
  for (const row of sectionRows) {
    lines.push(`| ${row.section} | ${row.taskCount} | ${row.hours} | ${row.costWithContingency} |`);
  }
  lines.push('');

  lines.push('## Agent System Status');
  lines.push('');
  lines.push(`- Backlog summary: todo=${data.agent.todo}, in_progress=${data.agent.inProgress}, blocked=${data.agent.blocked}, done=${data.agent.done}`);
  lines.push(`- Active task (Agent-A): ${data.agent.ownerRows.find((row) => row.owner === 'Agent-A')?.active || '-'}`);
  lines.push('');

  lines.push('## Current Blockers');
  lines.push('');
  if (blockers.length === 0) {
    lines.push('- None');
  } else {
    for (const blocker of blockers) {
      lines.push(`- ${blocker}`);
    }
  }
  lines.push('');

  lines.push('## Step-by-Step Execution (Go-Live Flow)');
  lines.push('');
  lines.push('1. Rebuild docs-based COS and effort baseline: `pnpm ops:bootstrap:docs`');
  lines.push('2. Verify module contracts: `pnpm ops:integration:check`');
  lines.push('3. Verify cost workflow: `pnpm ops:effort:workflow:check`');
  lines.push('4. Produce consolidated roadmap report: `pnpm ops:flow:roadmap`');
  lines.push('5. Enable transfer env vars (`GITHUB_REPO`, `GITHUB_TOKEN`, `KANBAN_PROJECT_ID`) and push tasks: `pnpm ops:bootstrap:docs:push -- --project-id <PROJECT_UUID>`');
  lines.push('6. Re-run step 4 and verify transfer gate is `pass`.');
  lines.push('');

  lines.push('## Evidence Files');
  lines.push('');
  lines.push(`- \`${path.relative(root, bootstrapPath)}\``);
  lines.push(`- \`${path.relative(root, costCheckPath)}\``);
  lines.push(`- \`${path.relative(root, integrationPath)}\``);
  lines.push(`- \`${path.relative(root, agentNextPath)}\``);
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const shouldWrite = args.has('--write');

  const bootstrap = readJson(bootstrapPath);
  const costMd = readText(costCheckPath);
  const integrationMd = readText(integrationPath);
  const agentMd = readText(agentNextPath);

  const data = {
    bootstrap,
    cost: parseCostSummary(costMd),
    integration: parseIntegrationSummary(integrationMd),
    agent: parseAgentSummary(agentMd),
  };

  const report = buildReport(data);
  console.log(report);

  if (shouldWrite) {
    fs.writeFileSync(outputPath, report, 'utf8');
    console.log(`[effort-flow-roadmap] wrote ${outputPath}`);
  }
}

main();
