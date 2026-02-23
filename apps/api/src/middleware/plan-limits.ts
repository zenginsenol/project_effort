import { TRPCError } from '@trpc/server';

import { middleware, orgProcedure } from '../trpc/trpc';
import { billingService } from '../routers/billing/service';

type LimitType = 'projects' | 'teamMembers' | 'estimationSessions' | 'aiAnalyses';

/**
 * Creates a middleware that checks plan limits before executing mutations
 * @param limitType - The type of limit to check (projects, teamMembers, etc.)
 * @returns A middleware that enforces the plan limit
 */
function createPlanLimitMiddleware(limitType: LimitType) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.orgId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Organization context required',
      });
    }

    // Check plan limit
    const limitCheck = await billingService.checkPlanLimit(ctx.orgId, limitType);

    if (!limitCheck.allowed) {
      const limitName = limitType
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .trim();

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Plan limit reached: You have reached your ${limitCheck.plan} plan limit of ${limitCheck.limit} ${limitName}. Please upgrade your plan to continue.`,
        cause: {
          limitType,
          current: limitCheck.current,
          limit: limitCheck.limit,
          plan: limitCheck.plan,
          upgradeRequired: true,
        },
      });
    }

    return next({
      ctx,
    });
  });
}

/**
 * Generic middleware that can be used to check any plan limit
 * Usage: withPlanLimit('projects')
 */
export const withPlanLimit = createPlanLimitMiddleware;

/**
 * Middleware that checks if organization can create more AI analyses
 */
export const checkPlanLimit = createPlanLimitMiddleware;

/**
 * Procedure that enforces AI analysis plan limits
 * Use this instead of orgProcedure for AI analysis mutations
 */
export const aiAnalysisProcedure = orgProcedure.use(createPlanLimitMiddleware('aiAnalyses'));

/**
 * Procedure that enforces project plan limits
 * Use this instead of orgProcedure for project creation mutations
 */
export const projectProcedure = orgProcedure.use(createPlanLimitMiddleware('projects'));

/**
 * Procedure that enforces team member plan limits
 * Use this instead of orgProcedure for team member addition mutations
 */
export const teamMemberProcedure = orgProcedure.use(createPlanLimitMiddleware('teamMembers'));

/**
 * Procedure that enforces estimation session plan limits
 * Use this instead of orgProcedure for estimation session creation mutations
 */
export const estimationSessionProcedure = orgProcedure.use(createPlanLimitMiddleware('estimationSessions'));
