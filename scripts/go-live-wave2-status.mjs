#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const backlogPath = path.resolve(root, 'agent-ops/agent-backlog.json');
const outputPath = path.resolve(root, 'agent-ops/ops/go-live-wave2-status.md');

if (!fs.existsSync(backlogPath)) {
  console.error(`[wave2-status] Backlog not found: ${backlogPath}`);
  process.exit(1);
}

const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
const phaseH = backlog.tasks.filter((task) => task.phase === 'Phase H');

const gateMap = {
  'Gate-1 Technical Hardening': ['H-001', 'H-002', 'H-003', 'H-004', 'H-009'],
  'Gate-2 Product + QA Readiness': ['H-005', 'H-006', 'H-007', 'H-010', 'H-011', 'H-012'],
  'Gate-3 Cutover Authorization': ['H-013', 'H-014', 'H-015'],
  'Gate-4 Hypercare Closure': ['H-016', 'H-017'],
};

const byId = new Map(phaseH.map((task) => [task.id, task]));
const count = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
for (const task of phaseH) {
  if (count[task.status] !== undefined) count[task.status] += 1;
}

function gateStatus(taskIds) {
  const tasks = taskIds.map((id) => byId.get(id)).filter(Boolean);
  const done = tasks.filter((task) => task.status === 'done');
  const inProgress = tasks.filter((task) => task.status === 'in_progress');
  const blocked = tasks.filter((task) => task.status === 'blocked');

  if (tasks.length === 0) return { label: 'missing', detail: 'No tasks mapped' };
  if (done.length === tasks.length) return { label: 'done', detail: `${done.length}/${tasks.length} done` };
  if (blocked.length > 0) return { label: 'blocked', detail: `${blocked.length} blocked` };
  if (inProgress.length > 0) return { label: 'in_progress', detail: `${done.length}/${tasks.length} done, ${inProgress.length} active` };
  return { label: 'pending', detail: `${done.length}/${tasks.length} done` };
}

const lines = [];
lines.push('# Wave-2 Go-Live Status');
lines.push('');
lines.push(`Updated: ${new Date().toISOString()}`);
lines.push('');
lines.push(`Phase-H Summary: todo=${count.todo}, in_progress=${count.in_progress}, blocked=${count.blocked}, done=${count.done}`);
lines.push('');
lines.push('## Gate Status');
lines.push('');
lines.push('| Gate | Status | Detail |');
lines.push('|---|---|---|');

for (const [gate, taskIds] of Object.entries(gateMap)) {
  const s = gateStatus(taskIds);
  lines.push(`| ${gate} | ${s.label} | ${s.detail} |`);
}

lines.push('');
lines.push('## Active Tasks');
lines.push('');
const active = phaseH.filter((task) => task.status === 'in_progress');
if (active.length === 0) {
  lines.push('- None');
} else {
  for (const task of active) {
    lines.push(`- \`${task.id}\` (${task.owner}) ${task.title}`);
  }
}

lines.push('');
lines.push('## Blocked Tasks');
lines.push('');
const blockedTasks = phaseH.filter((task) => task.status === 'blocked');
if (blockedTasks.length === 0) {
  lines.push('- None');
} else {
  for (const task of blockedTasks) {
    lines.push(`- \`${task.id}\` (${task.owner}) ${task.title} :: ${task.blockReason || 'no reason'}`);
  }
}

lines.push('');
const content = `${lines.join('\n')}\n`;
console.log(content);

if (process.argv.includes('--write')) {
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`[wave2-status] wrote ${outputPath}`);
}
