#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputPath = path.resolve(root, 'agent-ops/ops/module-integration-check-latest.md');

const contractChecks = [
  {
    id: 'effort-roadmap-contract',
    area: 'Effort <-> Kanban',
    producerFile: 'apps/api/src/routers/effort/router.ts',
    producerTokens: [
      'roadmap: orgProcedure',
      'applyRoadmap: orgProcedure',
    ],
    consumerFile: 'apps/web/src/app/dashboard/effort/page.tsx',
    consumerTokens: [
      'trpc.effort.roadmap.useQuery',
      'trpc.effort.applyRoadmap.useMutation',
    ],
  },
  {
    id: 'github-project-link-contract',
    area: 'Project <-> GitHub Integration',
    producerFile: 'apps/api/src/routers/integration/router.ts',
    producerTokens: [
      'getGithubProjectLink: orgProcedure',
      'linkGithubProject: orgProcedure',
      'syncGithubProject: orgProcedure',
    ],
    consumerFile: 'apps/web/src/app/dashboard/projects/[projectId]/page.tsx',
    consumerTokens: [
      'trpc.integration.getGithubProjectLink.useQuery',
      'trpc.integration.linkGithubProject.useMutation',
      'trpc.integration.syncGithubProject.useMutation',
    ],
  },
  {
    id: 'oauth-start-callback-contract',
    area: 'Settings <-> OAuth API callback',
    producerFile: 'apps/api/src/routers/api-keys/router.ts',
    producerTokens: [
      'startOAuthLogin: authedProcedure',
    ],
    consumerFile: 'apps/web/src/app/dashboard/settings/page.tsx',
    consumerTokens: [
      'trpc.apiKeys.startOAuthLogin.useMutation',
    ],
    bridgeFile: 'apps/api/src/server.ts',
    bridgeTokens: [
      "fastify.get('/auth/openai/callback'",
    ],
  },
  {
    id: 'document-analysis-contract',
    area: 'Analyzer <-> Document API',
    producerFile: 'apps/api/src/server.ts',
    producerTokens: [
      "fastify.post('/api/analyze-document'",
      'extractTasksFromText(',
    ],
    consumerFile: 'apps/web/src/app/dashboard/analyzer/page.tsx',
    consumerTokens: [
      '/api/analyze-document',
    ],
  },
];

function safeExec(command) {
  try {
    return execSync(command, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error
      ? String(error.stderr || '').trim()
      : '';
    throw new Error(stderr || `command failed: ${command}`);
  }
}

function fileContent(relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}

function missingTokens(content, tokens) {
  if (content === null) {
    return [...tokens];
  }
  return tokens.filter((token) => !content.includes(token));
}

function runContractChecks() {
  const results = [];

  for (const check of contractChecks) {
    const producerContent = fileContent(check.producerFile);
    const consumerContent = fileContent(check.consumerFile);
    const bridgeContent = check.bridgeFile ? fileContent(check.bridgeFile) : undefined;

    const producerMissing = missingTokens(producerContent, check.producerTokens);
    const consumerMissing = missingTokens(consumerContent, check.consumerTokens);
    const bridgeMissing = check.bridgeTokens
      ? missingTokens(bridgeContent ?? null, check.bridgeTokens)
      : [];

    const ok = producerMissing.length === 0
      && consumerMissing.length === 0
      && bridgeMissing.length === 0;

    results.push({
      ...check,
      ok,
      producerMissing,
      consumerMissing,
      bridgeMissing,
    });
  }

  return results;
}

function workingTreeSummary() {
  const raw = safeExec('git status --porcelain');
  const lines = raw.split('\n').filter(Boolean);
  const tracked = lines.filter((line) => !line.startsWith('??')).length;
  const untracked = lines.filter((line) => line.startsWith('??')).length;
  return {
    tracked,
    untracked,
    total: lines.length,
  };
}

function runQualityGateIfRequested() {
  if (!process.argv.includes('--with-gate')) {
    return { ran: false, ok: true, message: 'skipped' };
  }

  try {
    execSync('pnpm quality:gate', { cwd: root, stdio: 'inherit' });
    return { ran: true, ok: true, message: 'passed' };
  } catch {
    return { ran: true, ok: false, message: 'failed' };
  }
}

function formatMissing(tokens) {
  if (tokens.length === 0) {
    return '-';
  }
  return tokens.map((token) => `\`${token}\``).join(', ');
}

function buildReport(checks, qualityGate, tree) {
  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;
  const branch = safeExec('git rev-parse --abbrev-ref HEAD').trim();

  const lines = [];
  lines.push('# Module Integration Check');
  lines.push('');
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Branch: \`${branch}\``);
  lines.push(`Working tree: tracked=${tree.tracked}, untracked=${tree.untracked}, total=${tree.total}`);
  lines.push(`Contract checks: ${passed}/${checks.length} passed`);
  lines.push(`Quality gate: ${qualityGate.ran ? qualityGate.message : 'not requested'}`);
  lines.push('');
  lines.push('## Contract Matrix');
  lines.push('');
  lines.push('| Area | Status | Producer Missing | Consumer Missing | Bridge Missing |');
  lines.push('|---|---|---|---|---|');
  for (const check of checks) {
    lines.push(
      `| ${check.area} | ${check.ok ? 'pass' : 'fail'} | ${formatMissing(check.producerMissing)} | ${formatMissing(check.consumerMissing)} | ${formatMissing(check.bridgeMissing)} |`,
    );
  }
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  lines.push('1. Resolve failing contract lines before merge.');
  lines.push('2. Re-run `pnpm ops:integration:check` after each hotspot batch.');
  lines.push('3. Run `pnpm ops:integration:gate` before production cutover.');
  lines.push('');

  return {
    content: `${lines.join('\n')}\n`,
    hasFailure: failed > 0 || (qualityGate.ran && !qualityGate.ok),
  };
}

const checks = runContractChecks();
const qualityGate = runQualityGateIfRequested();
const tree = workingTreeSummary();
const report = buildReport(checks, qualityGate, tree);

console.log(report.content);

if (process.argv.includes('--write')) {
  fs.writeFileSync(outputPath, report.content, 'utf8');
  console.log(`[module-integration-check] wrote ${outputPath}`);
}

if (report.hasFailure) {
  process.exit(1);
}
