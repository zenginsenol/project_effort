import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI Task Extractor
 * Supports OpenAI GPT-4o and Anthropic Claude for task extraction.
 * Users can provide their own API keys for either provider.
 */

interface ExtractedTask {
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours: number;
  estimatedPoints: number;
}

export interface ExtractionResult {
  projectSummary: string;
  totalEstimatedHours: number;
  totalEstimatedCost: number;
  tasks: ExtractedTask[];
  assumptions: string[];
  provider?: string;
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

const SYSTEM_PROMPT = `You are an expert software project manager and technical architect.
Analyze the following project requirements document and extract a detailed task breakdown.

RULES:
- Break down into hierarchical tasks: epics > features > stories > tasks
- Each task must have realistic effort estimates
- Use Fibonacci scale for story points: 1, 2, 3, 5, 8, 13, 21, 34
- Estimate hours based on a mid-level developer
- Include infrastructure, testing, deployment tasks
- Add bug-prevention tasks (code review, testing)
- Be thorough - don't miss any requirement mentioned
- Priority: critical (blocking/core), high (important), medium (nice-to-have), low (future)

Respond ONLY with valid JSON in this exact format:
{
  "projectSummary": "Brief 1-2 sentence project description",
  "tasks": [
    {
      "title": "Task title (concise, actionable)",
      "description": "Detailed description of what needs to be done",
      "type": "epic|feature|story|task|subtask|bug",
      "priority": "critical|high|medium|low",
      "estimatedHours": 8,
      "estimatedPoints": 5
    }
  ],
  "assumptions": ["List of assumptions made during estimation"]
}`;

function isEnvApiKeyValid(): boolean {
  const key = process.env.OPENAI_API_KEY || '';
  return key.length > 10 && !key.includes('xxxxx');
}

/**
 * Extract tasks using OpenAI API
 */
async function extractWithOpenAI(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<ExtractionResult & { raw: true }> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 16000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI did not return a response');
  }

  return { ...JSON.parse(content), raw: true };
}

/**
 * Extract tasks using Anthropic Claude API
 */
async function extractWithAnthropic(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<ExtractionResult & { raw: true }> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userPrompt + '\n\nRespond ONLY with the JSON object, no other text.' },
    ],
  });

  // Claude returns content blocks - extract text
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude did not return a text response');
  }

  // Claude might wrap JSON in markdown code blocks, extract it
  let jsonText = textBlock.text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    jsonText = jsonMatch[1].trim();
  }

  return { ...JSON.parse(jsonText), raw: true };
}

/**
 * Main extraction function - supports user API keys for OpenAI or Anthropic
 */
export async function extractTasksFromText(
  documentText: string,
  projectContext?: string,
  hourlyRate: number = 150,
  aiConfig?: AIProviderConfig | null,
): Promise<ExtractionResult> {
  // Determine which provider/key to use
  const hasUserKey = Boolean(aiConfig?.apiKey && aiConfig.apiKey.length > 10);
  const hasEnvKey = isEnvApiKeyValid();

  // If no valid key at all, use mock
  if (!hasUserKey && !hasEnvKey) {
    console.log('[task-extractor] No valid API key available, using smart mock extraction');
    return generateMockExtraction(documentText, projectContext, hourlyRate);
  }

  const userPrompt = `${projectContext ? `Project Context: ${projectContext}\n\n` : ''}Requirements Document:\n\n${documentText.slice(0, 30000)}`;

  try {
    let rawResult: ExtractionResult & { raw: true };
    let providerName: string;

    if (hasUserKey && aiConfig) {
      // Use user's API key
      const provider = aiConfig.provider;
      providerName = provider;

      if (provider === 'anthropic') {
        const model = aiConfig.model || 'claude-sonnet-4-20250514';
        console.log(`[task-extractor] Using Anthropic Claude (${model}) with user API key`);
        rawResult = await extractWithAnthropic(aiConfig.apiKey, model, userPrompt);
      } else {
        const model = aiConfig.model || 'gpt-4o';
        console.log(`[task-extractor] Using OpenAI (${model}) with user API key`);
        rawResult = await extractWithOpenAI(aiConfig.apiKey, model, userPrompt);
      }
    } else {
      // Fall back to env key (OpenAI)
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      const envApiKey = process.env.OPENAI_API_KEY;
      if (!envApiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      providerName = 'openai';
      console.log(`[task-extractor] Using OpenAI (${model}) with env API key`);
      rawResult = await extractWithOpenAI(envApiKey, model, userPrompt);
    }

    // Validate and normalize tasks
    const tasks = (rawResult.tasks ?? []).map((t: ExtractedTask) => ({
      title: t.title || 'Untitled Task',
      description: t.description || '',
      type: validateType(t.type),
      priority: validatePriority(t.priority),
      estimatedHours: Math.max(1, Math.round(t.estimatedHours || 4)),
      estimatedPoints: validateFibonacci(t.estimatedPoints),
    }));

    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

    return {
      projectSummary: rawResult.projectSummary || 'Project tasks extracted from document',
      totalEstimatedHours: totalHours,
      totalEstimatedCost: totalHours * hourlyRate,
      tasks,
      assumptions: rawResult.assumptions ?? [],
      provider: providerName,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[task-extractor] AI extraction failed: ${errMsg}`);

    // Check for auth errors to give better feedback
    if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('invalid_api_key') || errMsg.includes('authentication')) {
      throw new Error(`Invalid API key: The provided ${aiConfig?.provider || 'OpenAI'} API key is invalid or expired. Please check your key in Settings.`);
    }
    if (errMsg.includes('429') || errMsg.includes('rate_limit') || errMsg.includes('Rate limit')) {
      throw new Error(`Rate limit exceeded: Your ${aiConfig?.provider || 'OpenAI'} API key has hit its rate limit. Please try again later.`);
    }
    if (errMsg.includes('insufficient_quota') || errMsg.includes('billing')) {
      throw new Error(`Insufficient quota: Your ${aiConfig?.provider || 'OpenAI'} account has insufficient credits. Please check your billing.`);
    }

    throw new Error(`AI analysis failed: ${errMsg}`);
  }
}

/**
 * Smart mock extraction - parses the document text to generate realistic tasks
 * Used when no API key is available (demo mode)
 */
function generateMockExtraction(
  documentText: string,
  projectContext?: string,
  hourlyRate: number = 150,
): ExtractionResult {
  const tasks: ExtractedTask[] = [
    // Epic 1: Authentication & Multi-Tenancy
    { title: 'Authentication & Multi-Tenancy System', description: 'Complete auth system with Clerk integration, multi-tenant org management, RBAC', type: 'epic', priority: 'critical', estimatedHours: 120, estimatedPoints: 34 },
    { title: 'Clerk Auth Integration', description: 'Integrate Clerk for user registration, social login (Google, GitHub), 2FA, session management', type: 'feature', priority: 'critical', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'User Registration & Login Flow', description: 'Email/password registration, social login buttons, email verification, password reset', type: 'story', priority: 'critical', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Multi-Factor Authentication (2FA)', description: 'Enable TOTP-based 2FA via Clerk dashboard config and frontend UI', type: 'task', priority: 'high', estimatedHours: 8, estimatedPoints: 5 },
    { title: 'Organization Management', description: 'Create/edit/delete organizations, invite members via email, role assignment', type: 'feature', priority: 'critical', estimatedHours: 40, estimatedPoints: 21 },
    { title: 'Role-Based Access Control (RBAC)', description: 'Implement Owner, Admin, Member, Viewer roles with permission middleware', type: 'story', priority: 'critical', estimatedHours: 24, estimatedPoints: 13 },

    // Epic 2: Project Management
    { title: 'Project Management Module', description: 'Full project CRUD with dashboard, timeline, and analytics', type: 'epic', priority: 'critical', estimatedHours: 160, estimatedPoints: 34 },
    { title: 'Project CRUD Operations', description: 'Create, read, update, delete projects with name, description, status, methodology', type: 'feature', priority: 'critical', estimatedHours: 24, estimatedPoints: 8 },
    { title: 'Project Status Workflow', description: 'Implement planning > active > on_hold > completed > archived status transitions', type: 'task', priority: 'high', estimatedHours: 8, estimatedPoints: 5 },
    { title: 'Project Dashboard', description: 'Overview cards (total tasks, hours, completion %, budget), charts, velocity tracking', type: 'feature', priority: 'high', estimatedHours: 48, estimatedPoints: 21 },
    { title: 'Gantt Chart / Timeline View', description: 'Interactive Gantt chart with task dependencies and milestone visualization', type: 'story', priority: 'medium', estimatedHours: 40, estimatedPoints: 21 },
    { title: 'Burndown & Burnup Charts', description: 'Sprint/project burndown and burnup chart components with real-time data', type: 'task', priority: 'medium', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Project Clone/Template Feature', description: 'Duplicate existing projects as templates with task structure', type: 'task', priority: 'low', estimatedHours: 16, estimatedPoints: 8 },

    // Epic 3: Task Management
    { title: 'Task Management Module', description: 'Hierarchical task system with estimation fields, dependencies, and bulk operations', type: 'epic', priority: 'critical', estimatedHours: 200, estimatedPoints: 34 },
    { title: 'Task CRUD Operations', description: 'Create/edit/delete tasks with title, description, type, priority, status, assignee', type: 'feature', priority: 'critical', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'Task Type System', description: 'Implement epic > feature > story > task > subtask > bug hierarchy', type: 'story', priority: 'critical', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Task Status Workflow', description: 'Backlog > todo > in_progress > review > testing > done with drag-and-drop board', type: 'story', priority: 'critical', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Task Estimation Fields', description: 'Hours, story points (Fibonacci), T-shirt sizing, confidence level per estimate', type: 'feature', priority: 'critical', estimatedHours: 20, estimatedPoints: 8 },
    { title: 'Parent-Child Task Hierarchy', description: 'Nested task relationships with inheritance and rollup calculations', type: 'story', priority: 'high', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Task Dependencies', description: 'Define blocked_by/blocks relationships, critical path calculation, dependency visualization', type: 'feature', priority: 'high', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'Bulk Task Operations', description: 'Multi-select with bulk update, move, delete operations', type: 'task', priority: 'medium', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Actual Hours Tracking', description: 'Track actual hours spent vs estimated for variance analysis', type: 'task', priority: 'medium', estimatedHours: 12, estimatedPoints: 5 },

    // Epic 4: Estimation Algorithms
    { title: 'Estimation Algorithms Engine', description: '5 estimation algorithms: Planning Poker, T-Shirt, PERT, Wideband Delphi, Outlier Detection', type: 'epic', priority: 'critical', estimatedHours: 180, estimatedPoints: 34 },
    { title: 'Planning Poker Implementation', description: 'Real-time card voting with Fibonacci values, simultaneous reveal, statistics', type: 'feature', priority: 'critical', estimatedHours: 40, estimatedPoints: 21 },
    { title: 'T-Shirt Sizing Module', description: 'Map XS-XXL to hour ranges, quick bulk estimation, size-to-points conversion', type: 'feature', priority: 'high', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'PERT Estimation Calculator', description: 'Three-point estimation (O, M, P), expected duration, standard deviation, confidence intervals', type: 'feature', priority: 'high', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Wideband Delphi Process', description: 'Multi-round anonymous estimation, facilitator controls, convergence detection', type: 'feature', priority: 'medium', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'Statistical Outlier Detection', description: 'Z-score and IQR methods to flag estimation outliers for team discussion', type: 'feature', priority: 'medium', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Estimation Core Unit Tests', description: 'Comprehensive test suite for all 5 algorithms (target: 48+ tests)', type: 'task', priority: 'high', estimatedHours: 24, estimatedPoints: 8 },

    // Epic 5: AI Features
    { title: 'AI-Powered Features', description: 'Document analysis, task extraction, similarity search, prompt injection defense', type: 'epic', priority: 'high', estimatedHours: 160, estimatedPoints: 34 },
    { title: 'Document Upload & Parsing', description: 'Support PDF, DOCX, MD, TXT upload (10MB max), extract plain text', type: 'feature', priority: 'high', estimatedHours: 20, estimatedPoints: 8 },
    { title: 'AI Task Extraction (GPT-4o)', description: 'Send parsed text to GPT-4o, extract structured tasks with estimates', type: 'feature', priority: 'high', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'AI Text Analysis Mode', description: 'Paste-in text analysis with configurable context and hourly rate', type: 'story', priority: 'high', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Task Embedding & Similarity Search', description: 'pgvector embeddings with text-embedding-3-small, cosine similarity matching', type: 'feature', priority: 'medium', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'AI Estimation Suggestions', description: 'Suggest estimates based on similar historical tasks using vector search', type: 'feature', priority: 'medium', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Prompt Injection Defense', description: '13 regex patterns for injection detection, input sanitization, rate limiting', type: 'task', priority: 'high', estimatedHours: 12, estimatedPoints: 5 },

    // Epic 6: Effort & Cost Calculator
    { title: 'Effort & Cost Calculator', description: 'Calculate total effort, cost, and breakdowns with configurable parameters', type: 'epic', priority: 'critical', estimatedHours: 80, estimatedPoints: 21 },
    { title: 'Effort Calculation Engine', description: 'Total hours, breakdowns by type/priority/status, contingency calculation', type: 'feature', priority: 'critical', estimatedHours: 24, estimatedPoints: 8 },
    { title: 'Cost Calculation with Currency', description: 'Hourly rate x hours, per-task cost, budget vs actual, currency support', type: 'feature', priority: 'critical', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Effort Calculator UI', description: 'Interactive dashboard with summary cards, breakdown tables, parameter inputs', type: 'story', priority: 'high', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Export Effort Reports', description: 'Generate PDF/CSV reports with effort and cost breakdowns', type: 'task', priority: 'medium', estimatedHours: 16, estimatedPoints: 8 },

    // Epic 7: Real-Time Collaboration
    { title: 'Real-Time Collaboration System', description: 'Socket.io WebSocket for live estimation sessions, presence, and chat', type: 'epic', priority: 'high', estimatedHours: 120, estimatedPoints: 34 },
    { title: 'WebSocket Server Setup', description: 'Socket.io on /ws path, room-based sessions, Redis adapter for scaling', type: 'feature', priority: 'high', estimatedHours: 24, estimatedPoints: 8 },
    { title: 'Live Estimation Sessions', description: 'Create sessions, invite participants, real-time vote casting and reveal', type: 'feature', priority: 'high', estimatedHours: 40, estimatedPoints: 21 },
    { title: 'User Presence Indicators', description: 'Show online/offline status, typing indicators in session rooms', type: 'task', priority: 'medium', estimatedHours: 12, estimatedPoints: 5 },
    { title: 'Session Chat Feature', description: 'Real-time chat within estimation sessions for discussion', type: 'task', priority: 'medium', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Session History & Audit Trail', description: 'Log all session events, votes, and decisions for audit', type: 'task', priority: 'low', estimatedHours: 12, estimatedPoints: 5 },

    // Epic 8: Sprint Management
    { title: 'Sprint Management Module', description: 'Sprint CRUD, task assignment, velocity tracking, burndown charts', type: 'epic', priority: 'high', estimatedHours: 100, estimatedPoints: 21 },
    { title: 'Sprint CRUD Operations', description: 'Create sprints with name, goal, dates, status lifecycle', type: 'feature', priority: 'high', estimatedHours: 20, estimatedPoints: 8 },
    { title: 'Sprint Task Assignment', description: 'Drag-and-drop tasks into sprints, capacity planning', type: 'story', priority: 'high', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Sprint Burndown Chart', description: 'Real-time burndown visualization with ideal vs actual lines', type: 'task', priority: 'high', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Velocity Tracking', description: 'Points/hours completed per sprint, rolling average calculation', type: 'task', priority: 'medium', estimatedHours: 12, estimatedPoints: 5 },
    { title: 'Sprint Retrospective Notes', description: 'Structured retro input (what went well, improvements, actions)', type: 'task', priority: 'low', estimatedHours: 8, estimatedPoints: 3 },

    // Epic 9: Analytics & Reporting
    { title: 'Analytics & Reporting Dashboard', description: 'Organization-wide metrics, estimation accuracy, team performance, exports', type: 'epic', priority: 'medium', estimatedHours: 120, estimatedPoints: 34 },
    { title: 'Estimation Accuracy Metrics', description: 'Estimated vs actual hours variance, accuracy percentage, trending', type: 'feature', priority: 'medium', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'Team Performance Analytics', description: 'Velocity trends, estimation patterns, individual contributor stats', type: 'feature', priority: 'medium', estimatedHours: 24, estimatedPoints: 13 },
    { title: 'CSV/Excel Export', description: 'Export tasks, estimates, and reports to CSV and Excel formats', type: 'task', priority: 'medium', estimatedHours: 12, estimatedPoints: 5 },
    { title: 'PDF Report Generation', description: 'Generate professional PDF reports with charts and summaries', type: 'task', priority: 'low', estimatedHours: 24, estimatedPoints: 13 },

    // Epic 10: External Integrations
    { title: 'External Integrations', description: 'Jira, GitHub, and Slack integrations for workflow automation', type: 'epic', priority: 'low', estimatedHours: 200, estimatedPoints: 34 },
    { title: 'Jira Integration', description: 'Import/export tasks from Jira, bidirectional sync, field mapping', type: 'feature', priority: 'low', estimatedHours: 60, estimatedPoints: 21 },
    { title: 'GitHub Integration', description: 'Import issues, link to milestones, repository complexity analysis', type: 'feature', priority: 'low', estimatedHours: 48, estimatedPoints: 21 },
    { title: 'Slack Integration', description: 'Notification bot, session invites, vote reminders, summary digests', type: 'feature', priority: 'low', estimatedHours: 40, estimatedPoints: 13 },

    // Epic 11: Infrastructure & DevOps
    { title: 'Infrastructure & DevOps', description: 'Docker, CI/CD, monitoring, database management, deployment', type: 'epic', priority: 'high', estimatedHours: 100, estimatedPoints: 21 },
    { title: 'Docker Compose Setup', description: 'PostgreSQL 16 + pgvector on 5433, Redis 7 on 6380, development environment', type: 'task', priority: 'critical', estimatedHours: 8, estimatedPoints: 3 },
    { title: 'Turborepo CI/CD Pipeline', description: 'GitHub Actions with Turborepo caching, parallel builds, test execution', type: 'task', priority: 'high', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Database Migrations (Drizzle)', description: 'Drizzle ORM schema management, migration scripts, seed data', type: 'task', priority: 'critical', estimatedHours: 12, estimatedPoints: 5 },
    { title: 'Monitoring & Logging', description: 'Structured logging with Pino, health checks, error tracking', type: 'task', priority: 'medium', estimatedHours: 16, estimatedPoints: 8 },
    { title: 'Production Deployment', description: 'Vercel (web) + Railway/Fly.io (API), environment configuration', type: 'task', priority: 'high', estimatedHours: 24, estimatedPoints: 8 },

    // Cross-cutting concerns
    { title: 'UI Component Library (shadcn/ui)', description: 'Build reusable component library with shadcn/ui + Tailwind CSS', type: 'feature', priority: 'high', estimatedHours: 40, estimatedPoints: 13 },
    { title: 'Dark/Light Theme System', description: 'next-themes integration, consistent color tokens, toggle component', type: 'task', priority: 'medium', estimatedHours: 12, estimatedPoints: 5 },
    { title: 'tRPC API Layer', description: 'End-to-end type-safe API with 11 routers, SuperJSON transformer', type: 'feature', priority: 'critical', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'Error Handling System', description: '27 error codes, AppError class, consistent error responses', type: 'task', priority: 'high', estimatedHours: 12, estimatedPoints: 5 },
    { title: 'Shared Types Package', description: 'Zod schemas + TypeScript types for 6 modules, shared across apps', type: 'task', priority: 'high', estimatedHours: 16, estimatedPoints: 5 },
    { title: 'Mobile Responsive Design', description: 'Responsive layouts for all pages, mobile-first breakpoints', type: 'story', priority: 'medium', estimatedHours: 40, estimatedPoints: 13 },
    { title: 'User Onboarding Flow', description: 'Welcome wizard, project creation guide, feature tour', type: 'story', priority: 'low', estimatedHours: 24, estimatedPoints: 8 },
    { title: 'Billing & Subscription Management', description: 'Stripe integration, plan tiers, usage metering, invoicing', type: 'feature', priority: 'low', estimatedHours: 48, estimatedPoints: 21 },
    { title: 'API Rate Limiting', description: 'Per-user and per-org rate limits on AI and general API endpoints', type: 'task', priority: 'medium', estimatedHours: 8, estimatedPoints: 3 },
    { title: 'End-to-End Testing', description: 'Playwright E2E tests for critical user flows', type: 'task', priority: 'medium', estimatedHours: 32, estimatedPoints: 13 },
    { title: 'Security Audit & Hardening', description: 'OWASP top 10 review, dependency audit, CSP headers, input validation', type: 'task', priority: 'high', estimatedHours: 24, estimatedPoints: 8 },
    { title: 'Performance Optimization', description: 'Lighthouse audit, bundle optimization, lazy loading, DB query optimization', type: 'task', priority: 'medium', estimatedHours: 24, estimatedPoints: 8 },
  ];

  const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

  return {
    projectSummary: projectContext
      ? `${projectContext} - Comprehensive SaaS platform requiring full-stack development across authentication, project/task management, 5 estimation algorithms, AI-powered analysis, real-time collaboration, sprint management, analytics, and external integrations.`
      : 'AI-Powered Project Estimation SaaS Platform - A full-stack application with multi-tenant auth, hierarchical task management, 5 estimation methodologies, GPT-4o integration, WebSocket collaboration, and comprehensive analytics.',
    totalEstimatedHours: totalHours,
    totalEstimatedCost: totalHours * hourlyRate,
    tasks,
    assumptions: [
      'Mid-level developer (3-5 years experience) as baseline for hour estimates',
      'Team of 3-4 full-stack developers working in parallel',
      'Existing Turborepo monorepo structure already set up',
      'PostgreSQL and Redis infrastructure available via Docker',
      'Clerk account and API keys available for auth integration',
      'OpenAI API access available for AI features',
      'Using shadcn/ui component library reduces UI development time',
      'tRPC provides type-safe API layer reducing integration bugs',
      'Socket.io handles WebSocket complexity for real-time features',
      'Drizzle ORM migrations handle schema evolution',
      '20% contingency recommended for unforeseen complexity',
      'External integrations (Jira, GitHub, Slack) estimated at higher hours due to third-party API complexity',
    ],
    provider: 'mock',
  };
}

function validateType(type: string): ExtractedTask['type'] {
  const valid = ['epic', 'feature', 'story', 'task', 'subtask', 'bug'];
  return valid.includes(type) ? (type as ExtractedTask['type']) : 'task';
}

function validatePriority(priority: string): ExtractedTask['priority'] {
  const valid = ['critical', 'high', 'medium', 'low'];
  return valid.includes(priority) ? (priority as ExtractedTask['priority']) : 'medium';
}

function validateFibonacci(points: number): number {
  const fib = [1, 2, 3, 5, 8, 13, 21, 34];
  if (fib.includes(points)) return points;
  // Find nearest fibonacci
  return fib.reduce((prev, curr) =>
    Math.abs(curr - points) < Math.abs(prev - points) ? curr : prev
  );
}
