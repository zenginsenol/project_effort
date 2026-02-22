#!/usr/bin/env node

/**
 * Lighthouse Performance Audit Script
 * Tests key pages: /dashboard/projects and /dashboard/analytics
 * Target: Performance score > 90
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

const PAGES_TO_AUDIT = [
  {
    url: 'http://localhost:3000/dashboard/projects',
    name: 'Dashboard Projects',
  },
  {
    url: 'http://localhost:3000/dashboard/analytics',
    name: 'Dashboard Analytics',
  },
];

const TARGET_PERFORMANCE_SCORE = 90;

async function runAudit(url, name) {
  console.log(`\n🔍 Auditing: ${name}`);
  console.log(`   URL: ${url}`);

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });

  try {
    const options = {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
      disableStorageReset: false,
      formFactor: 'desktop',
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
      screenEmulation: {
        mobile: false,
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        disabled: false,
      },
    };

    const runnerResult = await lighthouse(url, options);

    const performanceScore = runnerResult.lhr.categories.performance.score * 100;
    const metrics = runnerResult.lhr.audits;

    return {
      name,
      url,
      performanceScore: Math.round(performanceScore),
      metrics: {
        firstContentfulPaint: metrics['first-contentful-paint'].displayValue,
        largestContentfulPaint: metrics['largest-contentful-paint'].displayValue,
        totalBlockingTime: metrics['total-blocking-time'].displayValue,
        cumulativeLayoutShift: metrics['cumulative-layout-shift'].displayValue,
        speedIndex: metrics['speed-index'].displayValue,
      },
      passed: performanceScore >= TARGET_PERFORMANCE_SCORE,
    };
  } finally {
    await chrome.kill();
  }
}

async function main() {
  console.log('🚀 Starting Lighthouse Performance Audit');
  console.log(`   Target Performance Score: ${TARGET_PERFORMANCE_SCORE}`);
  console.log('   Testing on desktop with fast network throttling');

  const results = [];

  for (const page of PAGES_TO_AUDIT) {
    try {
      const result = await runAudit(page.url, page.name);
      results.push(result);
    } catch (error) {
      console.error(`\n❌ Error auditing ${page.name}:`, error.message);
      results.push({
        name: page.name,
        url: page.url,
        performanceScore: 0,
        metrics: {},
        passed: false,
        error: error.message,
      });
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(80));
  console.log('📊 LIGHTHOUSE PERFORMANCE AUDIT RESULTS');
  console.log('='.repeat(80) + '\n');

  let allPassed = true;
  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    console.log(`   Score: ${result.performanceScore}/100 (target: ${TARGET_PERFORMANCE_SCORE})`);

    if (result.metrics && Object.keys(result.metrics).length > 0) {
      console.log('   Metrics:');
      console.log(`     - First Contentful Paint: ${result.metrics.firstContentfulPaint}`);
      console.log(`     - Largest Contentful Paint: ${result.metrics.largestContentfulPaint}`);
      console.log(`     - Total Blocking Time: ${result.metrics.totalBlockingTime}`);
      console.log(`     - Cumulative Layout Shift: ${result.metrics.cumulativeLayoutShift}`);
      console.log(`     - Speed Index: ${result.metrics.speedIndex}`);
    }

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    console.log('');

    if (!result.passed) {
      allPassed = false;
    }
  });

  // Save detailed report
  const reportPath = path.join(__dirname, '.auto-claude/specs/006-performance-optimization-sub-second-response-times/lighthouse-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  // Exit with appropriate code
  if (allPassed) {
    console.log('✅ All pages passed the performance threshold!\n');
    process.exit(0);
  } else {
    console.log('❌ Some pages failed to meet the performance threshold.\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
