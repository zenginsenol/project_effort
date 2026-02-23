# N+1 Query Fix Verification

## Changes Made
Fixed N+1 query in `EffortService.getProjectAndTasks` by using Drizzle's relational query API with `with` clause.

### Before (2 queries)
```typescript
// Query 1: Fetch project
const project = await db.query.projects.findFirst({...});

// Query 2: Fetch tasks
const taskList = await db.select({...}).from(tasks).where(...);
```

### After (1 query with JOIN)
```typescript
// Single query with LEFT JOIN
const result = await db.query.projects.findFirst({
  columns: {...},
  where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
  with: {
    tasks: {
      columns: {...},
    },
  },
});
```

## Manual Verification Steps

To verify this fix works correctly:

1. **Enable Drizzle query logging** by modifying `packages/db/src/index.ts`:
```typescript
export const db = drizzle(client, {
  schema,
  logger: true  // Add this line
});
```

2. **Start the API server**:
```bash
cd apps/api
pnpm dev
```

3. **Call any endpoint that uses EffortService**:
   - Calculate project effort: `POST /api/trpc/effort.calculateProjectEffort`
   - Generate roadmap: `POST /api/trpc/effort.generateRoadmap`
   - Apply roadmap to kanban: `POST /api/trpc/effort.applyRoadmapToKanban`

4. **Check the console logs** - you should see:
   - **Before fix**: 2 separate SQL queries (SELECT from projects, then SELECT from tasks)
   - **After fix**: 1 SQL query with a LEFT JOIN between projects and tasks

## Expected SQL Output

With logging enabled, you should see a single query like:
```sql
SELECT
  projects.id,
  projects.name,
  projects.key,
  tasks.id,
  tasks.title,
  tasks.type,
  -- ... other task columns
FROM projects
LEFT JOIN tasks ON tasks.project_id = projects.id
WHERE projects.id = $1 AND projects.organization_id = $2
```

Instead of:
```sql
-- Query 1
SELECT id, name, key FROM projects WHERE id = $1 AND organization_id = $2;

-- Query 2
SELECT id, title, type, ... FROM tasks WHERE project_id = $1;
```

## Performance Impact

- **Queries reduced**: From 2 to 1 (50% reduction)
- **Network round-trips**: From 2 to 1
- **Database load**: Reduced latency and connection overhead
- **Scalability**: Better performance as project/task count grows
