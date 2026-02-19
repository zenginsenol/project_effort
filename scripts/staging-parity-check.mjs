#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readEnvKeys(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && line.includes('='))
    .map((line) => line.split('=')[0]?.trim())
    .filter(Boolean);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const envExamplePath = path.join(root, '.env.example');
  const envStagingPath = path.join(root, '.env.staging.example');
  const dockerComposePath = path.join(root, 'docker-compose.yml');

  assert(fs.existsSync(envExamplePath), '.env.example is missing');
  assert(fs.existsSync(envStagingPath), '.env.staging.example is missing');
  assert(fs.existsSync(dockerComposePath), 'docker-compose.yml is missing');

  const baseKeys = readEnvKeys(envExamplePath);
  const stagingKeys = readEnvKeys(envStagingPath);
  const missingInStaging = baseKeys.filter((key) => !stagingKeys.includes(key));

  assert(missingInStaging.length === 0, `Staging env is missing keys: ${missingInStaging.join(', ')}`);

  const compose = fs.readFileSync(dockerComposePath, 'utf8');
  assert(compose.includes('postgres:'), 'docker-compose.yml must define postgres service');
  assert(compose.includes('redis:'), 'docker-compose.yml must define redis service');

  const requiredScripts = [
    'scripts/quality-gate.mjs',
    'scripts/agent-orchestrator.mjs',
  ];

  for (const relativePath of requiredScripts) {
    const absolute = path.join(root, relativePath);
    assert(fs.existsSync(absolute), `${relativePath} is missing`);
  }

  console.log('Staging parity check passed');
  console.log(`Validated keys: ${baseKeys.length}`);
  console.log('Services: postgres, redis');
}

try {
  run();
} catch (error) {
  console.error('Staging parity check failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
