import Redis from 'ioredis';
import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { usageTracking } from '@estimate-pro/db/schema';

type UsageType = 'aiAnalyses' | 'projects' | 'teamMembers' | 'estimationSessions';

export class UsageTracker {
  private redis: Redis | null = null;

  private getRedisClient(): Redis {
    if (!this.redis) {
      const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });
    }
    return this.redis;
  }

  private getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7); // YYYY-MM format
  }

  private getRedisKey(orgId: string, usageType: UsageType, month?: string): string {
    const targetMonth = month ?? this.getCurrentMonth();
    return `usage:${orgId}:${targetMonth}:${usageType}`;
  }

  async incrementAiAnalysis(orgId: string): Promise<number> {
    return this.incrementUsage(orgId, 'aiAnalyses');
  }

  async incrementProject(orgId: string): Promise<number> {
    return this.incrementUsage(orgId, 'projects');
  }

  async incrementTeamMember(orgId: string): Promise<number> {
    return this.incrementUsage(orgId, 'teamMembers');
  }

  async incrementEstimationSession(orgId: string): Promise<number> {
    return this.incrementUsage(orgId, 'estimationSessions');
  }

  private async incrementUsage(orgId: string, usageType: UsageType): Promise<number> {
    const redis = this.getRedisClient();
    const month = this.getCurrentMonth();
    const key = this.getRedisKey(orgId, usageType, month);

    // Increment counter in Redis
    const newCount = await redis.incr(key);

    // Set expiration to end of next month (to allow for billing period overlap)
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 2);
    expirationDate.setDate(1);
    expirationDate.setHours(0, 0, 0, 0);
    const ttlSeconds = Math.floor((expirationDate.getTime() - Date.now()) / 1000);
    await redis.expire(key, ttlSeconds);

    // Sync to database asynchronously (fire and forget)
    this.syncToDatabase(orgId, month, usageType, newCount).catch((error) => {
      console.error(`Failed to sync usage to database: ${error}`);
    });

    return newCount;
  }

  async getCurrentUsage(orgId: string, month?: string): Promise<{
    month: string;
    aiAnalyses: number;
    projects: number;
    teamMembers: number;
    estimationSessions: number;
  }> {
    const targetMonth = month ?? this.getCurrentMonth();
    const redis = this.getRedisClient();

    // Try to get from Redis first (real-time data)
    const [aiAnalyses, projects, teamMembers, estimationSessions] = await Promise.all([
      redis.get(this.getRedisKey(orgId, 'aiAnalyses', targetMonth)),
      redis.get(this.getRedisKey(orgId, 'projects', targetMonth)),
      redis.get(this.getRedisKey(orgId, 'teamMembers', targetMonth)),
      redis.get(this.getRedisKey(orgId, 'estimationSessions', targetMonth)),
    ]);

    // If Redis has data, use it
    if (aiAnalyses !== null || projects !== null || teamMembers !== null || estimationSessions !== null) {
      return {
        month: targetMonth,
        aiAnalyses: parseInt(aiAnalyses ?? '0', 10),
        projects: parseInt(projects ?? '0', 10),
        teamMembers: parseInt(teamMembers ?? '0', 10),
        estimationSessions: parseInt(estimationSessions ?? '0', 10),
      };
    }

    // Fallback to database
    const usage = await db.query.usageTracking.findFirst({
      where: and(
        eq(usageTracking.organizationId, orgId),
        eq(usageTracking.monthYear, targetMonth),
      ),
    });

    const result = {
      month: targetMonth,
      aiAnalyses: usage?.aiAnalysesCount ?? 0,
      projects: usage?.projectsCount ?? 0,
      teamMembers: usage?.teamMembersCount ?? 0,
      estimationSessions: usage?.estimationSessionsCount ?? 0,
    };

    // Populate Redis cache from database
    if (usage) {
      await this.populateRedisFromDatabase(orgId, targetMonth, result);
    }

    return result;
  }

  async checkLimit(
    orgId: string,
    usageType: UsageType,
    limit: number,
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const usage = await this.getCurrentUsage(orgId);
    let currentCount = 0;

    switch (usageType) {
      case 'aiAnalyses':
        currentCount = usage.aiAnalyses;
        break;
      case 'projects':
        currentCount = usage.projects;
        break;
      case 'teamMembers':
        currentCount = usage.teamMembers;
        break;
      case 'estimationSessions':
        currentCount = usage.estimationSessions;
        break;
    }

    // -1 means unlimited
    const allowed = limit === -1 || currentCount < limit;

    return {
      allowed,
      current: currentCount,
      limit,
    };
  }

  async resetMonthlyCounters(orgId: string, month?: string): Promise<void> {
    const targetMonth = month ?? this.getCurrentMonth();
    const redis = this.getRedisClient();

    // Delete Redis keys for the month
    const keys = [
      this.getRedisKey(orgId, 'aiAnalyses', targetMonth),
      this.getRedisKey(orgId, 'projects', targetMonth),
      this.getRedisKey(orgId, 'teamMembers', targetMonth),
      this.getRedisKey(orgId, 'estimationSessions', targetMonth),
    ];

    await redis.del(...keys);

    // Reset database counters
    const existing = await db.query.usageTracking.findFirst({
      where: and(
        eq(usageTracking.organizationId, orgId),
        eq(usageTracking.monthYear, targetMonth),
      ),
    });

    if (existing) {
      await db
        .update(usageTracking)
        .set({
          aiAnalysesCount: 0,
          projectsCount: 0,
          teamMembersCount: 0,
          estimationSessionsCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(usageTracking.id, existing.id));
    }
  }

  private async syncToDatabase(
    orgId: string,
    month: string,
    usageType: UsageType,
    count: number,
  ): Promise<void> {
    // Find existing record
    const existing = await db.query.usageTracking.findFirst({
      where: and(
        eq(usageTracking.organizationId, orgId),
        eq(usageTracking.monthYear, month),
      ),
    });

    // Map usage type to database column
    const columnMap = {
      aiAnalyses: 'aiAnalysesCount',
      projects: 'projectsCount',
      teamMembers: 'teamMembersCount',
      estimationSessions: 'estimationSessionsCount',
    } as const;

    const column = columnMap[usageType];

    if (existing) {
      // Update existing record
      await db
        .update(usageTracking)
        .set({
          [column]: count,
          updatedAt: new Date(),
        })
        .where(eq(usageTracking.id, existing.id));
    } else {
      // Create new record
      await db.insert(usageTracking).values({
        organizationId: orgId,
        monthYear: month,
        [column]: count,
      });
    }
  }

  private async populateRedisFromDatabase(
    orgId: string,
    month: string,
    usage: {
      aiAnalyses: number;
      projects: number;
      teamMembers: number;
      estimationSessions: number;
    },
  ): Promise<void> {
    const redis = this.getRedisClient();
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 2);
    expirationDate.setDate(1);
    expirationDate.setHours(0, 0, 0, 0);
    const ttlSeconds = Math.floor((expirationDate.getTime() - Date.now()) / 1000);

    await Promise.all([
      redis.set(this.getRedisKey(orgId, 'aiAnalyses', month), usage.aiAnalyses, 'EX', ttlSeconds),
      redis.set(this.getRedisKey(orgId, 'projects', month), usage.projects, 'EX', ttlSeconds),
      redis.set(this.getRedisKey(orgId, 'teamMembers', month), usage.teamMembers, 'EX', ttlSeconds),
      redis.set(this.getRedisKey(orgId, 'estimationSessions', month), usage.estimationSessions, 'EX', ttlSeconds),
    ]);
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

export const usageTracker = new UsageTracker();
