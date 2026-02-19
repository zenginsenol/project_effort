# EstimatePro - Project Guide

## Project Overview
- EstimatePro is an AI-powered project effort estimation platform for agile software teams
- Monorepo architecture with Turborepo
- Multi-tenant SaaS application

## Architecture
```
project_effort/
├── apps/
│   ├── api/          # Fastify + tRPC backend server
│   └── web/          # Next.js 15 App Router frontend
├── packages/
│   ├── db/           # Drizzle ORM + PostgreSQL schemas
│   ├── types/        # Shared Zod schemas + TypeScript types
│   ├── ui/           # shadcn/ui component library
│   ├── errors/       # Error codes + AppError classes
│   ├── estimation-core/  # Pure TS estimation algorithms
│   ├── typescript-config/ # Shared TypeScript configs
│   └── eslint-config/    # Shared ESLint configs
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js (App Router) | 15 |
| API Layer | tRPC | v11 |
| Backend Server | Fastify | 5 |
| Database | PostgreSQL | 16 |
| ORM | Drizzle ORM | latest |
| Cache/Queue | Redis | 7 |
| Real-Time | Socket.io | 4 |
| AI | OpenAI API | GPT-4o |
| Auth | Clerk | latest |
| Monorepo | Turborepo | latest |
| UI Components | shadcn/ui | latest |
| State Management | Zustand | latest |
| Data Fetching | TanStack Query | v5 |
| Styling | Tailwind CSS | v4 |
| Testing | Vitest + Playwright | latest |
| Package Manager | pnpm | 9 |

## Coding Conventions

### File Naming
- Files/directories: `kebab-case` (e.g., `task-detail.tsx`, `estimation-core/`)
- React components: `PascalCase` export (e.g., `export function TaskDetail()`)
- Database tables/columns: `snake_case` (e.g., `created_at`, `organization_id`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- Types/Interfaces: `PascalCase` (e.g., `TaskEstimate`, `ProjectSettings`)

### TypeScript Rules (Strict Mode)
```typescript
// tsconfig strict settings - ALL enabled
// FORBIDDEN:
// - `any` type (use `unknown` + type guards)
// - Non-null assertion `!` (use optional chaining or null checks)
// - Type assertion `as` (use type guards or generics)
// - @ts-ignore / @ts-expect-error (fix the type instead)

// REQUIRED:
// - Explicit return types on exported functions
// - Readonly arrays/objects where mutation is not needed
// - Discriminated unions over optional properties
```

### tRPC Router Conventions
```typescript
// Procedure hierarchy (most restrictive to least):
// publicProcedure    → No auth required
// authedProcedure    → Requires valid Clerk JWT
// orgProcedure       → Requires auth + org membership
// adminProcedure     → Requires auth + org admin role

// Router file structure:
// src/routers/{domain}/
//   ├── router.ts      → Route definitions
//   ├── service.ts     → Business logic
//   ├── schema.ts      → Zod input/output schemas
//   └── __tests__/     → Tests

// Input validation: Always use Zod schemas
// Output: Return typed objects, never raw DB rows
// Errors: Use TRPCError with appropriate code
```

### Drizzle ORM Schema Conventions
```typescript
// Every table MUST have:
// - `id` → uuid primary key (crypto.randomUUID())
// - `created_at` → timestamp, default now()
// - `updated_at` → timestamp, default now(), onUpdate
// - Proper indexes on foreign keys and frequent query columns

// Naming:
// - Tables: plural snake_case (e.g., `projects`, `task_estimates`)
// - Columns: snake_case (e.g., `organization_id`, `estimated_hours`)
// - Foreign keys: `{referenced_table_singular}_id` (e.g., `project_id`)
// - Indexes: `idx_{table}_{column}` (e.g., `idx_tasks_project_id`)
```

### Import Order
```typescript
// 1. Node built-ins
import { readFile } from 'node:fs/promises';

// 2. External packages
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// 3. Internal packages (monorepo)
import { db } from '@estimate-pro/db';
import type { Project } from '@estimate-pro/types';

// 4. Relative imports (parent → sibling → child)
import { createContext } from '../context';
import { validateInput } from './helpers';
import { ProjectCard } from './components/project-card';

// 5. Type-only imports at the end
import type { AppRouter } from './router';
```

## Git Workflow

### Branch Naming
```
feat/{module}-{description}   → New features
fix/{module}-{description}    → Bug fixes
refactor/{module}-{description} → Refactoring
chore/{description}           → Maintenance
```

### Conventional Commits
```
feat(api): add organization tRPC router
fix(web): resolve task board drag-and-drop offset
refactor(db): normalize estimation schema
chore: update dependencies
test(estimation-core): add PERT calculator tests
docs: update API documentation
```

## Testing Requirements

### Unit Tests (Vitest)
- Minimum **80%** code coverage
- Co-located with source: `__tests__/` directory next to source
- File naming: `{source-file}.test.ts`
- Use `describe/it` blocks with descriptive names
- Mock external dependencies (DB, Redis, OpenAI)

### E2E Tests (Playwright)
- Located in `apps/web/e2e/`
- Test critical user flows:
  - Auth (sign-in, sign-up, sign-out)
  - Project CRUD
  - Estimation session (Planning Poker, PERT)
  - Real-time collaboration

### Running Tests
```bash
pnpm test              # Run all unit tests
pnpm test:coverage     # Run with coverage report
pnpm test:e2e          # Run Playwright E2E tests
pnpm test:e2e:ui       # Run E2E with Playwright UI
```

## Security Guidelines
- All user input validated with Zod schemas at API boundary
- SQL injection prevention via Drizzle ORM parameterized queries
- XSS prevention via React's default escaping + DOMPurify for rich text
- CSRF protection via Clerk session tokens
- Rate limiting on all API endpoints (Redis sliding window)
- AI prompt injection defense: sanitize all user input before OpenAI calls
- Secrets: Never commit `.env` files; use `.env.example` as template
- Multi-tenant isolation: Every query filtered by `organization_id`

## Performance Guidelines
- Database queries: Use proper indexes, avoid N+1 (use `with` relations in Drizzle)
- API responses: Paginate lists (default 20, max 100 items)
- Caching: Redis cache for expensive computations (AI suggestions, analytics)
- Frontend: React.memo for expensive components, virtual lists for large datasets
- Images: Next.js Image component with proper sizing
- Bundle: Dynamic imports for heavy components (charts, rich editors)

## Command Reference

```bash
# Development
pnpm dev               # Start all apps in dev mode
pnpm dev:api           # Start API server only
pnpm dev:web           # Start web app only

# Build
pnpm build             # Build all packages and apps
pnpm build:api         # Build API only
pnpm build:web         # Build web app only

# Testing
pnpm test              # Run all unit tests
pnpm test:coverage     # Run with coverage
pnpm test:e2e          # Run E2E tests

# Database
pnpm db:generate       # Generate Drizzle migration
pnpm db:push           # Push schema to database
pnpm db:migrate        # Run migrations
pnpm db:seed           # Seed database with sample data
pnpm db:studio         # Open Drizzle Studio

# Code Quality
pnpm lint              # Run ESLint
pnpm lint:fix          # Fix ESLint issues
pnpm typecheck         # Run TypeScript type checking
pnpm format            # Run Prettier
pnpm check             # Run lint + typecheck + format

# Infrastructure
docker compose up -d   # Start PostgreSQL + Redis
docker compose down    # Stop services
```

## Environment Variables
See `.env.example` for all required environment variables. Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `CLERK_SECRET_KEY` - Clerk authentication
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend
- `OPENAI_API_KEY` - OpenAI API access
- `NEXT_PUBLIC_APP_URL` - Application URL
