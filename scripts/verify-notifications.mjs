#!/usr/bin/env node

/**
 * Notification System Verification Script
 *
 * This script performs automated verification of the notification system:
 * 1. Checks database schema
 * 2. Verifies TypeScript compilation
 * 3. Lists verification steps
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function section(title) {
  console.log('');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  log(`  ${title}`, 'cyan');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  console.log('');
}

async function runCheck(name, command, successMessage) {
  try {
    log(`⏳ ${name}...`, 'yellow');
    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }

    log(`✅ ${successMessage}`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${name} failed:`, 'red');
    console.error(error.message);
    return false;
  }
}

async function main() {
  log('\n🔔 Notification System Verification\n', 'blue');

  const checks = [];

  // Section 1: Database Schema Verification
  section('1. Database Schema Verification');

  log('Checking if notification tables exist in the database schema...', 'cyan');
  checks.push(await runCheck(
    'Database schema files',
    'ls packages/db/src/schema/notifications.ts packages/db/src/schema/enums.ts',
    'Database schema files exist'
  ));

  // Section 2: TypeScript Compilation
  section('2. TypeScript Compilation');

  checks.push(await runCheck(
    'API TypeScript compilation',
    'cd apps/api && npx tsc --noEmit',
    'API compiles without TypeScript errors'
  ));

  checks.push(await runCheck(
    'Web TypeScript compilation',
    'cd apps/web && npx tsc --noEmit',
    'Web app compiles without TypeScript errors'
  ));

  // Section 3: File Existence Verification
  section('3. File Existence Verification');

  const files = [
    'apps/api/src/routers/notification/router.ts',
    'apps/api/src/routers/notification/service.ts',
    'apps/api/src/routers/notification/schema.ts',
    'apps/web/src/components/notification/notification-bell.tsx',
    'apps/web/src/components/notification/notification-center.tsx',
    'apps/web/src/components/notification/notification-item.tsx',
    'apps/web/src/providers/notification-provider.tsx',
    'apps/web/src/app/dashboard/settings/notifications/page.tsx',
    'apps/web/e2e/notification-flow.spec.ts',
  ];

  let filesExist = true;
  for (const file of files) {
    try {
      await execAsync(`test -f ${file}`);
      log(`  ✓ ${file}`, 'green');
    } catch {
      log(`  ✗ ${file} not found`, 'red');
      filesExist = false;
    }
  }

  if (filesExist) {
    log('✅ All required files exist', 'green');
    checks.push(true);
  } else {
    log('❌ Some files are missing', 'red');
    checks.push(false);
  }

  // Section 4: Manual Verification Steps
  section('4. Manual Verification Required');

  log('The following steps require manual verification:', 'yellow');
  log('', 'reset');
  log('1. Start services:', 'cyan');
  log('   docker compose up -d', 'reset');
  log('   npm run dev:api', 'reset');
  log('   npm run dev:web', 'reset');
  log('', 'reset');
  log('2. Navigate to:', 'cyan');
  log('   http://localhost:3000/dashboard', 'reset');
  log('', 'reset');
  log('3. Verify:', 'cyan');
  log('   • Bell icon appears in header', 'reset');
  log('   • Click bell to open notification center', 'reset');
  log('   • Notification center displays correctly', 'reset');
  log('   • WebSocket connection in console (check DevTools)', 'reset');
  log('', 'reset');
  log('4. Test notification preferences:', 'cyan');
  log('   http://localhost:3000/dashboard/settings/notifications', 'reset');
  log('   • All 7 notification types should be listed', 'reset');
  log('   • Toggle switches should work', 'reset');
  log('', 'reset');
  log('5. Run E2E tests:', 'cyan');
  log('   npm run test:e2e', 'reset');
  log('', 'reset');

  // Section 5: Summary
  section('Summary');

  const passed = checks.filter(Boolean).length;
  const total = checks.length;

  log(`Automated checks: ${passed}/${total} passed`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n✅ All automated checks passed!', 'green');
    log('Please complete the manual verification steps above.', 'cyan');
    log('\nFor detailed verification instructions, see:', 'cyan');
    log('.auto-claude/specs/004-in-app-notification-system/e2e-verification.md', 'blue');
    return 0;
  } else {
    log('\n❌ Some automated checks failed.', 'red');
    log('Please review the errors above and fix them before proceeding.', 'yellow');
    return 1;
  }
}

main().then(code => process.exit(code)).catch(err => {
  console.error(err);
  process.exit(1);
});
