#!/usr/bin/env node

import { execSync } from 'node:child_process';

const steps = [
  { name: 'build', cmd: 'pnpm build' },
  { name: 'lint', cmd: 'pnpm lint' },
  { name: 'typecheck', cmd: 'pnpm typecheck' },
  { name: 'test', cmd: 'pnpm test' },
];

for (const step of steps) {
  process.stdout.write(`\n[quality-gate] Running ${step.name}...\n`);
  try {
    execSync(step.cmd, { stdio: 'inherit' });
  } catch (error) {
    process.stderr.write(`\n[quality-gate] Failed at step: ${step.name}\n`);
    process.exit(1);
  }
}

process.stdout.write('\n[quality-gate] All steps passed.\n');
