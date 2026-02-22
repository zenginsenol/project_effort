#!/usr/bin/env node

/**
 * Simple webhook test server for testing webhook deliveries
 * Receives webhook POST requests and validates signatures
 *
 * Usage:
 *   node apps/api/scripts/webhook-test-server.mjs [port] [secret]
 *
 * Example:
 *   node apps/api/scripts/webhook-test-server.mjs 8080 your-webhook-secret
 */

import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';

// Parse command line arguments
const port = process.argv[2] || 8080;
const expectedSecret = process.argv[3] || '';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

/**
 * Verify webhook signature
 */
function verifySignature(payload, signature, secret) {
  if (!secret) {
    log('⚠️  No secret provided - skipping signature verification', 'yellow');
    return true;
  }

  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}

/**
 * Handle incoming webhook requests
 */
function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', () => {
    const timestamp = new Date().toISOString();
    const signature = req.headers['x-webhook-signature'];

    logSection(`Webhook Received - ${timestamp}`);

    // Log headers
    log('📋 Headers:', 'bright');
    log(`  Content-Type: ${req.headers['content-type']}`, 'cyan');
    log(`  User-Agent: ${req.headers['user-agent']}`, 'cyan');
    log(`  X-Webhook-Signature: ${signature || '(not provided)'}`, 'cyan');

    // Verify signature
    if (expectedSecret) {
      const isValid = verifySignature(body, signature, expectedSecret);
      if (isValid) {
        log('\n✅ Signature verification: PASSED', 'green');
      } else {
        log('\n❌ Signature verification: FAILED', 'red');
        log(`  Expected secret: ${expectedSecret}`, 'yellow');
        log(`  Received signature: ${signature}`, 'yellow');
      }
    }

    // Parse and log payload
    try {
      const payload = JSON.parse(body);
      log('\n📦 Payload:', 'bright');
      log(JSON.stringify(payload, null, 2), 'magenta');

      // Extract event details
      log('\n📊 Event Details:', 'bright');
      log(`  Event Type: ${payload.event}`, 'green');
      log(`  Timestamp: ${payload.timestamp}`, 'green');
      log(`  Organization: ${payload.organizationId}`, 'green');

      // Log event-specific data
      if (payload.data) {
        log('\n📄 Event Data:', 'bright');
        log(JSON.stringify(payload.data, null, 2), 'blue');
      }

      // Send success response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        received: timestamp,
        message: 'Webhook processed successfully'
      }));

      log('\n✅ Response sent: 200 OK', 'green');
    } catch (error) {
      log(`\n❌ Error parsing payload: ${error.message}`, 'red');
      log(`Raw body: ${body}`, 'yellow');

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));

      log('❌ Response sent: 400 Bad Request', 'red');
    }

    console.log(''); // Empty line for readability
  });
}

/**
 * Create and start the test server
 */
function startServer() {
  const server = createServer((req, res) => {
    // Add CORS headers for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    handleWebhook(req, res);
  });

  server.listen(port, () => {
    logSection('Webhook Test Server Started');
    log(`🚀 Server running on http://localhost:${port}`, 'green');
    log(`📡 Webhook URL: http://localhost:${port}/webhook`, 'cyan');

    if (expectedSecret) {
      log(`🔐 Secret: ${expectedSecret}`, 'yellow');
      log('✓ Signature verification: ENABLED', 'green');
    } else {
      log('⚠️  No secret provided - signature verification DISABLED', 'yellow');
      log('   To enable signature verification, run:', 'yellow');
      log(`   node ${process.argv[1]} ${port} your-webhook-secret`, 'cyan');
    }

    log('\n👂 Waiting for webhook deliveries...', 'bright');
    log('   Press Ctrl+C to stop\n', 'yellow');
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n\n🛑 Shutting down webhook test server...', 'yellow');
    server.close(() => {
      log('✅ Server stopped', 'green');
      process.exit(0);
    });
  });
}

// Start the server
startServer();
