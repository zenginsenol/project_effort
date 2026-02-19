import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { organizations } from '@estimate-pro/db/schema';

export class OrganizationService {
  async create(data: { name: string; slug: string; description?: string }) {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }

  async getById(id: string, orgId: string) {
    const org = await db.query.organizations.findFirst({
      where: and(eq(organizations.id, id), eq(organizations.id, orgId)),
      with: { members: true, projects: true },
    });
    return org ?? null;
  }

  async update(id: string, orgId: string, data: { name?: string; description?: string }) {
    const [org] = await db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(organizations.id, id), eq(organizations.id, orgId)))
      .returning();
    return org;
  }

  async list(orgId: string) {
    return db.query.organizations.findMany({
      where: eq(organizations.id, orgId),
      with: { members: true },
      orderBy: (orgs, { desc }) => [desc(orgs.createdAt)],
    });
  }
}

export const organizationService = new OrganizationService();
