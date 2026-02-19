import { router, publicProcedure } from '../trpc/trpc';

import { aiRouter } from './ai/router';
import { analyticsRouter } from './analytics/router';
import { apiKeysRouter } from './api-keys/router';
import { documentRouter } from './document/router';
import { effortRouter } from './effort/router';
import { integrationRouter } from './integration/router';
import { organizationRouter } from './organization/router';
import { projectRouter } from './project/router';
import { sessionRouter } from './session/router';
import { sprintRouter } from './sprint/router';
import { taskRouter } from './task/router';
import { teamRouter } from './team/router';

export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  organization: organizationRouter,
  project: projectRouter,
  task: taskRouter,
  team: teamRouter,
  session: sessionRouter,
  sprint: sprintRouter,
  ai: aiRouter,
  analytics: analyticsRouter,
  apiKeys: apiKeysRouter,
  document: documentRouter,
  effort: effortRouter,
  integration: integrationRouter,
});

export type AppRouter = typeof appRouter;
