#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputPath = path.resolve(root, 'agent-ops/ops/conflict-hotspots-latest.md');

const hotspots = [
  {
    id: 'oauth-architecture',
    risk: 'P0',
    title: 'OAuth callback architecture convergence',
    reason: 'Shared auth flow spans router, oauth service, and API callback route; partial merge can break login.',
    mergeOrder: '1) services/oauth 2) server callback route 3) api-keys router',
    patterns: [
      'apps/api/src/services/oauth/',
      'apps/api/src/server.ts',
      'apps/api/src/routers/api-keys/',
    ],
  },
  {
    id: 'provider-db-alignment',
    risk: 'P1',
    title: 'Provider schema and DB alignment',
    reason: 'Enum/column additions must stay aligned with router/input schemas and migrations.',
    mergeOrder: '1) DB migration SQL 2) schema enums/columns 3) API input/output schemas',
    patterns: [
      'packages/db/src/schema/',
      'apps/api/src/routers/api-keys/schema.ts',
      'apps/api/src/routers/api-keys/router.ts',
    ],
  },
  {
    id: 'document-analysis-contract',
    risk: 'P1',
    title: 'Document analysis contract drift',
    reason: 'Changes in extraction service and router schema can diverge and cause runtime parse errors.',
    mergeOrder: '1) document schema 2) extractor service 3) document router',
    patterns: [
      'apps/api/src/routers/document/',
      'apps/api/src/services/document/',
    ],
  },
  {
    id: 'web-settings-compare',
    risk: 'P2',
    title: 'Web settings/compare UX consistency',
    reason: 'Navigation, compare page, and settings panel can drift from backend capabilities.',
    mergeOrder: '1) compare route 2) settings page 3) sidebar/nav links',
    patterns: [
      'apps/web/src/app/dashboard/compare/',
      'apps/web/src/app/dashboard/settings/',
      'apps/web/src/components/layout/sidebar.tsx',
    ],
  },
];

function safeExec(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (err) {
    const stderr = err instanceof Error && 'stderr' in err ? String(err.stderr) : 'command failed';
    throw new Error(stderr.trim() || 'command failed');
  }
}

function parseGitStatus() {
  const raw = safeExec('git status --porcelain');
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || '??';
      const target = line.slice(3).trim();
      const filePath = target.includes(' -> ') ? target.split(' -> ')[1] : target;
      return { status, path: filePath };
    });
}

function matchesHotspot(filePath, patterns) {
  return patterns.some((prefix) => filePath.startsWith(prefix));
}

function formatHotspotSection(entry) {
  const lines = [];
  lines.push(`### ${entry.risk} - ${entry.title}`);
  lines.push('');
  lines.push(`Reason: ${entry.reason}`);
  lines.push(`Safe merge order: ${entry.mergeOrder}`);
  lines.push('');
  lines.push('| Status | File |');
  lines.push('|---|---|');
  for (const file of entry.files) {
    lines.push(`| \`${file.status}\` | \`${file.path}\` |`);
  }
  lines.push('');
  return lines;
}

function buildReport(files) {
  const branch = safeExec('git rev-parse --abbrev-ref HEAD').trim();
  const tracked = files.filter((f) => f.status !== '??').length;
  const untracked = files.filter((f) => f.status === '??').length;

  const mapped = hotspots
    .map((spot) => ({
      ...spot,
      files: files.filter((f) => matchesHotspot(f.path, spot.patterns)),
    }))
    .filter((spot) => spot.files.length > 0);

  const uncovered = files.filter(
    (f) => !hotspots.some((spot) => matchesHotspot(f.path, spot.patterns)),
  );

  const lines = [];
  lines.push('# Conflict Hotspots Report');
  lines.push('');
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Branch: \`${branch}\``);
  lines.push(`Working tree: tracked=${tracked}, untracked=${untracked}, total=${files.length}`);
  lines.push('');

  if (files.length === 0) {
    lines.push('No local changes detected. No active conflict hotspot.');
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Active Hotspots');
  lines.push('');
  if (mapped.length === 0) {
    lines.push('- None (changes do not match predefined hotspot patterns)');
    lines.push('');
  } else {
    for (const spot of mapped) {
      lines.push(...formatHotspotSection(spot));
    }
  }

  lines.push('## Unmapped Files');
  lines.push('');
  if (uncovered.length === 0) {
    lines.push('- None');
  } else {
    for (const file of uncovered) {
      lines.push(`- \`${file.status}\` \`${file.path}\``);
    }
  }
  lines.push('');
  lines.push('## Operator Notes');
  lines.push('');
  lines.push('- Stage and commit only files for one hotspot at a time.');
  lines.push('- Re-run `pnpm quality:gate` after each hotspot merge batch.');
  lines.push('- Keep OpenAI OAuth auth path intact; do not remove existing callback support until dual-mode checks pass.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

const files = parseGitStatus();
const report = buildReport(files);
console.log(report);

if (process.argv.includes('--write')) {
  fs.writeFileSync(outputPath, report, 'utf8');
  console.log(`[conflict-hotspots] wrote ${outputPath}`);
}
