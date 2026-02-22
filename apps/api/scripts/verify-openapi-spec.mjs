#!/usr/bin/env node

/**
 * OpenAPI Specification Verification Script
 *
 * This script verifies that the OpenAPI documentation is complete and accurate.
 * It checks:
 * - Swagger UI accessibility
 * - OpenAPI spec structure and validity
 * - Endpoint coverage
 * - Schema completeness
 * - Security configuration
 *
 * Usage: node apps/api/scripts/verify-openapi-spec.mjs
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DOCS_URL = `${API_URL}/api/docs`;
const SPEC_URL = `${API_URL}/api/docs/json`;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60));
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${name}`, color);
  if (details) {
    log(`  ${details}`, 'gray');
  }
}

// Expected endpoints grouped by tag
const EXPECTED_ENDPOINTS = {
  Projects: [
    { method: 'GET', path: '/api/v1/projects' },
    { method: 'GET', path: '/api/v1/projects/{id}' },
    { method: 'POST', path: '/api/v1/projects' },
    { method: 'PUT', path: '/api/v1/projects/{id}' },
    { method: 'DELETE', path: '/api/v1/projects/{id}' },
  ],
  Tasks: [
    { method: 'GET', path: '/api/v1/tasks' },
    { method: 'GET', path: '/api/v1/tasks/{id}' },
    { method: 'POST', path: '/api/v1/tasks' },
    { method: 'PATCH', path: '/api/v1/tasks/{id}' },
    { method: 'DELETE', path: '/api/v1/tasks/{id}' },
  ],
  Estimates: [
    { method: 'GET', path: '/api/v1/estimates' },
    { method: 'GET', path: '/api/v1/estimates/{id}' },
    { method: 'POST', path: '/api/v1/estimates' },
    { method: 'PATCH', path: '/api/v1/estimates/{id}' },
    { method: 'DELETE', path: '/api/v1/estimates/{id}' },
  ],
  'Cost Analyses': [
    { method: 'GET', path: '/api/v1/cost-analyses' },
    { method: 'GET', path: '/api/v1/cost-analyses/{id}' },
    { method: 'POST', path: '/api/v1/cost-analyses' },
    { method: 'PATCH', path: '/api/v1/cost-analyses/{id}' },
    { method: 'DELETE', path: '/api/v1/cost-analyses/{id}' },
    { method: 'POST', path: '/api/v1/cost-analyses/{id}/compare' },
    { method: 'POST', path: '/api/v1/cost-analyses/{id}/export' },
  ],
};

// Expected schemas in components
const EXPECTED_SCHEMAS = [
  'Error',
  'RateLimitError',
  'PaginationMeta',
  'Project',
  'Task',
];

async function checkServerHealth() {
  logSection('Server Health Check');

  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      logTest('API server is running', true, `${API_URL}/health`);
      return true;
    } else {
      logTest('API server health check failed', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Cannot connect to API server', false, error.message);
    log('\nPlease start the API server with: pnpm dev:api', 'yellow');
    return false;
  }
}

async function checkSwaggerUIAccessibility() {
  logSection('Swagger UI Accessibility');

  try {
    const response = await fetch(DOCS_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const html = await response.text();
      const hasSwaggerUI = html.includes('swagger-ui') || html.includes('Swagger UI');

      logTest('Swagger UI accessible at /api/docs', true, DOCS_URL);
      logTest('Swagger UI HTML contains expected content', hasSwaggerUI,
        hasSwaggerUI ? 'Found Swagger UI markers' : 'Missing Swagger UI content');

      return hasSwaggerUI;
    } else {
      logTest('Swagger UI not accessible', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Failed to fetch Swagger UI', false, error.message);
    return false;
  }
}

async function fetchOpenAPISpec() {
  logSection('OpenAPI Specification Fetch');

  try {
    const response = await fetch(SPEC_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logTest('Failed to fetch OpenAPI spec', false, `Status: ${response.status}`);
      return null;
    }

    const spec = await response.json();
    logTest('OpenAPI spec JSON fetched successfully', true, SPEC_URL);

    return spec;
  } catch (error) {
    logTest('Failed to parse OpenAPI spec', false, error.message);
    return null;
  }
}

function validateOpenAPIStructure(spec) {
  logSection('OpenAPI Structure Validation');

  if (!spec) {
    logTest('Spec is null or undefined', false);
    return false;
  }

  let allValid = true;

  // Check OpenAPI version
  const hasVersion = spec.openapi === '3.0.3';
  logTest('OpenAPI version 3.0.3', hasVersion, spec.openapi);
  allValid = allValid && hasVersion;

  // Check info object
  const hasInfo = spec.info && spec.info.title && spec.info.version;
  logTest('Info object present', hasInfo,
    hasInfo ? `${spec.info.title} v${spec.info.version}` : 'Missing info');
  allValid = allValid && hasInfo;

  // Check description
  const hasDescription = spec.info?.description?.length > 100;
  logTest('Comprehensive description', hasDescription,
    hasDescription ? `${spec.info.description.length} characters` : 'Description too short');
  allValid = allValid && hasDescription;

  // Check servers
  const hasServers = Array.isArray(spec.servers) && spec.servers.length > 0;
  logTest('Servers defined', hasServers,
    hasServers ? `${spec.servers.length} server(s)` : 'No servers');
  allValid = allValid && hasServers;

  // Check paths
  const hasPaths = spec.paths && Object.keys(spec.paths).length > 0;
  logTest('Paths defined', hasPaths,
    hasPaths ? `${Object.keys(spec.paths).length} endpoint(s)` : 'No paths');
  allValid = allValid && hasPaths;

  // Check components
  const hasComponents = spec.components && spec.components.schemas;
  logTest('Components defined', hasComponents,
    hasComponents ? `${Object.keys(spec.components.schemas).length} schema(s)` : 'No components');
  allValid = allValid && hasComponents;

  // Check security schemes
  const hasSecuritySchemes = spec.components?.securitySchemes?.ApiKeyAuth;
  logTest('Security schemes defined', hasSecuritySchemes,
    hasSecuritySchemes ? 'ApiKeyAuth configured' : 'Missing security schemes');
  allValid = allValid && hasSecuritySchemes;

  // Check tags
  const hasTags = Array.isArray(spec.tags) && spec.tags.length > 0;
  logTest('Tags defined', hasTags,
    hasTags ? `${spec.tags.length} tag(s)` : 'No tags');
  allValid = allValid && hasTags;

  return allValid;
}

function validateEndpointCoverage(spec) {
  logSection('Endpoint Coverage Validation');

  if (!spec || !spec.paths) {
    logTest('Cannot validate endpoints', false, 'Spec or paths missing');
    return false;
  }

  let allFound = true;
  let totalExpected = 0;
  let totalFound = 0;

  for (const [tag, endpoints] of Object.entries(EXPECTED_ENDPOINTS)) {
    log(`\n${tag}:`, 'blue');

    for (const { method, path } of endpoints) {
      totalExpected++;
      const methodLower = method.toLowerCase();
      const endpoint = spec.paths[path]?.[methodLower];
      const found = !!endpoint;

      if (found) {
        totalFound++;
      }

      logTest(`${method} ${path}`, found,
        found ? `Tags: ${endpoint.tags?.join(', ') || 'none'}` : 'Not found in spec');

      allFound = allFound && found;
    }
  }

  log(`\nCoverage: ${totalFound}/${totalExpected} endpoints documented`,
    totalFound === totalExpected ? 'green' : 'yellow');

  return allFound;
}

function validateSchemas(spec) {
  logSection('Schema Validation');

  if (!spec || !spec.components?.schemas) {
    logTest('Cannot validate schemas', false, 'Components or schemas missing');
    return false;
  }

  let allFound = true;

  for (const schemaName of EXPECTED_SCHEMAS) {
    const schema = spec.components.schemas[schemaName];
    const found = !!schema;

    logTest(`Schema: ${schemaName}`, found,
      found ? `Type: ${schema.type}, Properties: ${Object.keys(schema.properties || {}).length}` : 'Not found');

    allFound = allFound && found;
  }

  // Check for additional schemas
  const actualSchemas = Object.keys(spec.components.schemas);
  const extraSchemas = actualSchemas.filter(s => !EXPECTED_SCHEMAS.includes(s));

  if (extraSchemas.length > 0) {
    log(`\nAdditional schemas found: ${extraSchemas.join(', ')}`, 'gray');
  }

  return allFound;
}

function validateAuthentication(spec) {
  logSection('Authentication Configuration');

  if (!spec || !spec.components?.securitySchemes) {
    logTest('Security schemes missing', false);
    return false;
  }

  let allValid = true;

  const apiKeyAuth = spec.components.securitySchemes.ApiKeyAuth;

  // Check ApiKeyAuth configuration
  const hasApiKeyAuth = !!apiKeyAuth;
  logTest('ApiKeyAuth security scheme exists', hasApiKeyAuth);
  allValid = allValid && hasApiKeyAuth;

  if (hasApiKeyAuth) {
    const isHttpBearer = apiKeyAuth.type === 'http' && apiKeyAuth.scheme === 'bearer';
    logTest('Uses HTTP Bearer authentication', isHttpBearer,
      `Type: ${apiKeyAuth.type}, Scheme: ${apiKeyAuth.scheme}`);
    allValid = allValid && isHttpBearer;

    const hasDescription = apiKeyAuth.description?.length > 0;
    logTest('Has authentication description', hasDescription);
    allValid = allValid && hasDescription;
  }

  // Check global security requirement
  const hasGlobalSecurity = Array.isArray(spec.security) &&
    spec.security.some(s => s.ApiKeyAuth !== undefined);
  logTest('Global security requirement set', hasGlobalSecurity);
  allValid = allValid && hasGlobalSecurity;

  return allValid;
}

function validateDocumentation(spec) {
  logSection('Documentation Content Validation');

  if (!spec || !spec.info?.description) {
    logTest('Description missing', false);
    return false;
  }

  const description = spec.info.description;
  let allValid = true;

  // Check for key documentation sections
  const sections = [
    { name: 'Authentication', keyword: 'Authorization' },
    { name: 'Rate Limiting', keyword: 'Rate limit' },
    { name: 'Pagination', keyword: 'Pagination' },
    { name: 'Errors', keyword: 'Error' },
    { name: 'Webhooks', keyword: 'webhook' },
  ];

  for (const { name, keyword } of sections) {
    const found = description.toLowerCase().includes(keyword.toLowerCase());
    logTest(`Documentation includes ${name}`, found);
    allValid = allValid && found;
  }

  return allValid;
}

function printSummary(results) {
  logSection('Verification Summary');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('');
  for (const result of results) {
    logTest(result.name, result.passed);
  }

  console.log('');
  log(`Total: ${passed}/${total} checks passed`, passed === total ? 'green' : 'yellow');

  if (failed > 0) {
    log(`Failed: ${failed} check(s)`, 'red');
    console.log('\nSome verification checks failed. Please review the results above.');
    console.log('See OPENAPI_VERIFICATION.md for manual verification steps.\n');
    return false;
  } else {
    log('\n✓ All automated checks passed!', 'green');
    console.log('\nNext steps:');
    console.log('1. Perform manual verification using OPENAPI_VERIFICATION.md');
    console.log('2. Test endpoints directly from Swagger UI');
    console.log('3. Verify authentication and rate limiting');
    console.log('4. Update implementation_plan.json subtask-7-3 to completed\n');
    return true;
  }
}

async function main() {
  console.log('');
  log('╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║     OpenAPI Specification Verification Tool               ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  const results = [];

  // Step 1: Check server health
  const serverHealthy = await checkServerHealth();
  results.push({ name: 'Server Health', passed: serverHealthy });

  if (!serverHealthy) {
    printSummary(results);
    process.exit(1);
  }

  // Step 2: Check Swagger UI
  const swaggerAccessible = await checkSwaggerUIAccessibility();
  results.push({ name: 'Swagger UI Accessible', passed: swaggerAccessible });

  // Step 3: Fetch OpenAPI spec
  const spec = await fetchOpenAPISpec();
  results.push({ name: 'OpenAPI Spec Available', passed: !!spec });

  if (!spec) {
    printSummary(results);
    process.exit(1);
  }

  // Step 4: Validate structure
  const structureValid = validateOpenAPIStructure(spec);
  results.push({ name: 'OpenAPI Structure Valid', passed: structureValid });

  // Step 5: Validate endpoint coverage
  const endpointsComplete = validateEndpointCoverage(spec);
  results.push({ name: 'All Endpoints Documented', passed: endpointsComplete });

  // Step 6: Validate schemas
  const schemasComplete = validateSchemas(spec);
  results.push({ name: 'All Schemas Present', passed: schemasComplete });

  // Step 7: Validate authentication
  const authValid = validateAuthentication(spec);
  results.push({ name: 'Authentication Configured', passed: authValid });

  // Step 8: Validate documentation content
  const docsComplete = validateDocumentation(spec);
  results.push({ name: 'Documentation Complete', passed: docsComplete });

  // Print summary
  const allPassed = printSummary(results);

  process.exit(allPassed ? 0 : 1);
}

// Run the verification
main().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
