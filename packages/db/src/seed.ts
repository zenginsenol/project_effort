import 'dotenv/config';

import { db } from './index';
import { organizations } from './schema/organizations';
import { users, organizationMembers } from './schema/users';
import { projects } from './schema/projects';

async function seed(): Promise<void> {
  console.log('Seeding database...');

  const [org] = await db.insert(organizations).values({
    name: 'Acme Corp',
    slug: 'acme-corp',
    description: 'Demo organization for EstimatePro',
  }).returning();

  console.log('Created organization:', org?.name);

  const [user] = await db.insert(users).values({
    clerkId: 'user_demo_001',
    email: 'admin@acme.com',
    firstName: 'Demo',
    lastName: 'Admin',
  }).returning();

  console.log('Created user:', user?.email);

  if (org && user) {
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: 'owner',
    });

    const [project] = await db.insert(projects).values({
      organizationId: org.id,
      name: 'EstimatePro MVP',
      key: 'EP',
      description: 'The EstimatePro platform development project',
    }).returning();

    console.log('Created project:', project?.name);
  }

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
