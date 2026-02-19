import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { db } from './index';
import { organizations } from './schema/organizations';
import { projects } from './schema/projects';
import { tasks } from './schema/tasks';

async function seedDemo(): Promise<void> {
  console.log('Seeding demo project with realistic tasks...');

  // Find existing org
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, 'acme-corp'),
  });

  if (!org) {
    console.error('Organization not found. Run pnpm db:seed first.');
    process.exit(1);
  }

  // Check for existing demo project
  const existingProject = await db.query.projects.findFirst({
    where: eq(projects.key, 'ECOM'),
  });

  if (existingProject) {
    console.log('Demo project already exists, skipping seed.');
    process.exit(0);
  }

  // Create a realistic e-commerce project
  const [project] = await db.insert(projects).values({
    organizationId: org.id,
    name: 'E-Commerce Platform Modernization',
    key: 'ECOM',
    description: 'Complete modernization of the legacy e-commerce platform with microservices architecture, new UI/UX, payment integration, and analytics dashboard.',
    defaultEstimationMethod: 'planning_poker',
  }).returning();

  if (!project) {
    console.error('Failed to create demo project.');
    process.exit(1);
  }

  console.log('Created project:', project.name);

  // Realistic task breakdown for an e-commerce project
  const taskData: Array<{
    title: string;
    description: string;
    type: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug';
    status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedHours: number;
    estimatedPoints: number;
    actualHours: number | null;
  }> = [
    // Epic 1: User Authentication & Authorization
    { title: 'User Authentication System', description: 'Implement complete auth with OAuth2, JWT, 2FA', type: 'epic', status: 'done', priority: 'critical', estimatedHours: 120, estimatedPoints: 55, actualHours: 135 },
    { title: 'Login/Register UI', description: 'Design and implement login, register, forgot password screens', type: 'feature', status: 'done', priority: 'critical', estimatedHours: 24, estimatedPoints: 8, actualHours: 28 },
    { title: 'OAuth2 Integration (Google, GitHub)', description: 'Implement social login with Google and GitHub providers', type: 'story', status: 'done', priority: 'high', estimatedHours: 16, estimatedPoints: 5, actualHours: 20 },
    { title: 'JWT Token Management', description: 'Access/refresh token rotation, blacklisting, secure storage', type: 'task', status: 'done', priority: 'critical', estimatedHours: 20, estimatedPoints: 8, actualHours: 18 },
    { title: 'Two-Factor Authentication', description: 'TOTP-based 2FA with QR code setup', type: 'story', status: 'done', priority: 'high', estimatedHours: 16, estimatedPoints: 5, actualHours: 22 },
    { title: 'Role-Based Access Control', description: 'Admin, seller, buyer roles with granular permissions', type: 'feature', status: 'done', priority: 'critical', estimatedHours: 24, estimatedPoints: 13, actualHours: 26 },
    { title: 'Password Reset Flow', description: 'Email-based password reset with token expiry', type: 'task', status: 'done', priority: 'medium', estimatedHours: 8, estimatedPoints: 3, actualHours: 7 },
    { title: 'Session Management', description: 'Active sessions list, remote logout, device tracking', type: 'task', status: 'done', priority: 'medium', estimatedHours: 12, estimatedPoints: 5, actualHours: 14 },

    // Epic 2: Product Catalog
    { title: 'Product Catalog Module', description: 'Full product management with categories, variants, search', type: 'epic', status: 'in_progress', priority: 'critical', estimatedHours: 200, estimatedPoints: 89, actualHours: null },
    { title: 'Product CRUD API', description: 'Create, read, update, delete products with validation', type: 'feature', status: 'done', priority: 'critical', estimatedHours: 32, estimatedPoints: 13, actualHours: 30 },
    { title: 'Category Management', description: 'Nested category tree with drag-and-drop reordering', type: 'feature', status: 'done', priority: 'high', estimatedHours: 24, estimatedPoints: 8, actualHours: 28 },
    { title: 'Product Variants (Size, Color)', description: 'SKU management, variant pricing, stock per variant', type: 'story', status: 'in_progress', priority: 'high', estimatedHours: 28, estimatedPoints: 13, actualHours: null },
    { title: 'Product Image Gallery', description: 'Multi-image upload, crop, resize, CDN integration', type: 'story', status: 'in_progress', priority: 'medium', estimatedHours: 20, estimatedPoints: 8, actualHours: null },
    { title: 'Full-Text Search with Elasticsearch', description: 'Product search with filters, facets, autocomplete', type: 'feature', status: 'todo', priority: 'high', estimatedHours: 40, estimatedPoints: 21, actualHours: null },
    { title: 'Product Reviews & Ratings', description: 'User reviews with moderation, star ratings, helpful votes', type: 'feature', status: 'backlog', priority: 'medium', estimatedHours: 24, estimatedPoints: 8, actualHours: null },
    { title: 'Inventory Management', description: 'Stock tracking, low stock alerts, reorder points', type: 'feature', status: 'todo', priority: 'high', estimatedHours: 32, estimatedPoints: 13, actualHours: null },

    // Epic 3: Shopping Cart & Checkout
    { title: 'Shopping Cart & Checkout', description: 'Complete shopping cart with guest checkout, address management', type: 'epic', status: 'todo', priority: 'critical', estimatedHours: 160, estimatedPoints: 68, actualHours: null },
    { title: 'Shopping Cart (Add/Remove/Update)', description: 'Persistent cart with local storage fallback, quantity controls', type: 'feature', status: 'todo', priority: 'critical', estimatedHours: 24, estimatedPoints: 8, actualHours: null },
    { title: 'Address Management', description: 'Multiple shipping/billing addresses, address validation', type: 'story', status: 'backlog', priority: 'high', estimatedHours: 16, estimatedPoints: 5, actualHours: null },
    { title: 'Checkout Flow (Multi-step)', description: 'Cart review, shipping, payment, confirmation steps', type: 'feature', status: 'backlog', priority: 'critical', estimatedHours: 40, estimatedPoints: 21, actualHours: null },
    { title: 'Coupon/Discount System', description: 'Percentage, fixed, free shipping coupons with validation rules', type: 'feature', status: 'backlog', priority: 'medium', estimatedHours: 24, estimatedPoints: 8, actualHours: null },
    { title: 'Guest Checkout', description: 'Allow purchases without registration, merge cart on login', type: 'story', status: 'backlog', priority: 'medium', estimatedHours: 16, estimatedPoints: 5, actualHours: null },
    { title: 'Shipping Calculator', description: 'Integration with FedEx/UPS/DHL APIs for real-time rates', type: 'story', status: 'backlog', priority: 'high', estimatedHours: 20, estimatedPoints: 8, actualHours: null },
    { title: 'Order Confirmation & Email', description: 'Order summary email with PDF invoice', type: 'task', status: 'backlog', priority: 'medium', estimatedHours: 12, estimatedPoints: 5, actualHours: null },

    // Epic 4: Payment System
    { title: 'Payment Integration', description: 'Stripe, PayPal, bank transfer with PCI compliance', type: 'epic', status: 'backlog', priority: 'critical', estimatedHours: 140, estimatedPoints: 55, actualHours: null },
    { title: 'Stripe Integration', description: 'Card payments, Stripe Elements, webhooks, refunds', type: 'feature', status: 'backlog', priority: 'critical', estimatedHours: 40, estimatedPoints: 21, actualHours: null },
    { title: 'PayPal Integration', description: 'PayPal checkout button, express checkout', type: 'feature', status: 'backlog', priority: 'high', estimatedHours: 24, estimatedPoints: 8, actualHours: null },
    { title: 'Invoice Generation', description: 'PDF invoices with company branding, tax calculations', type: 'story', status: 'backlog', priority: 'medium', estimatedHours: 16, estimatedPoints: 5, actualHours: null },
    { title: 'Refund Processing', description: 'Full/partial refunds, refund reason tracking', type: 'story', status: 'backlog', priority: 'high', estimatedHours: 20, estimatedPoints: 8, actualHours: null },
    { title: 'Payment Webhook Handlers', description: 'Handle payment events: success, failure, dispute, chargeback', type: 'task', status: 'backlog', priority: 'critical', estimatedHours: 16, estimatedPoints: 5, actualHours: null },
    { title: 'Saved Payment Methods', description: 'Securely store and manage customer payment methods', type: 'story', status: 'backlog', priority: 'medium', estimatedHours: 12, estimatedPoints: 5, actualHours: null },
    { title: 'Tax Calculation Engine', description: 'VAT/GST calculation based on location, tax-exempt handling', type: 'task', status: 'backlog', priority: 'high', estimatedHours: 12, estimatedPoints: 3, actualHours: null },

    // Epic 5: Admin Dashboard
    { title: 'Admin Dashboard', description: 'Analytics, order management, user management, reports', type: 'epic', status: 'backlog', priority: 'high', estimatedHours: 180, estimatedPoints: 76, actualHours: null },
    { title: 'Dashboard Overview (KPIs)', description: 'Revenue, orders, users, conversion rate charts', type: 'feature', status: 'backlog', priority: 'high', estimatedHours: 32, estimatedPoints: 13, actualHours: null },
    { title: 'Order Management', description: 'Order list, status updates, fulfillment tracking', type: 'feature', status: 'backlog', priority: 'critical', estimatedHours: 40, estimatedPoints: 21, actualHours: null },
    { title: 'User Management', description: 'User list, ban/suspend, role assignment, activity log', type: 'feature', status: 'backlog', priority: 'high', estimatedHours: 28, estimatedPoints: 13, actualHours: null },
    { title: 'Sales Reports', description: 'Daily/weekly/monthly reports, CSV/PDF export', type: 'feature', status: 'backlog', priority: 'medium', estimatedHours: 24, estimatedPoints: 8, actualHours: null },
    { title: 'Inventory Reports', description: 'Stock levels, turnover rate, dead stock analysis', type: 'story', status: 'backlog', priority: 'medium', estimatedHours: 16, estimatedPoints: 5, actualHours: null },
    { title: 'Audit Log', description: 'Track all admin actions with timestamps and IP', type: 'task', status: 'backlog', priority: 'high', estimatedHours: 16, estimatedPoints: 5, actualHours: null },
    { title: 'Notification System', description: 'Email + in-app notifications for orders, stock alerts', type: 'feature', status: 'backlog', priority: 'medium', estimatedHours: 24, estimatedPoints: 8, actualHours: null },

    // Epic 6: Performance & Infrastructure
    { title: 'Performance & Infrastructure', description: 'CDN, caching, CI/CD, monitoring, load testing', type: 'epic', status: 'backlog', priority: 'high', estimatedHours: 100, estimatedPoints: 42, actualHours: null },
    { title: 'Redis Caching Layer', description: 'Cache product listings, session data, search results', type: 'task', status: 'backlog', priority: 'high', estimatedHours: 20, estimatedPoints: 8, actualHours: null },
    { title: 'CDN Setup (CloudFront)', description: 'Static assets, images via CloudFront with cache invalidation', type: 'task', status: 'backlog', priority: 'medium', estimatedHours: 12, estimatedPoints: 5, actualHours: null },
    { title: 'CI/CD Pipeline', description: 'GitHub Actions: lint, test, build, deploy to staging/prod', type: 'task', status: 'backlog', priority: 'high', estimatedHours: 20, estimatedPoints: 8, actualHours: null },
    { title: 'Monitoring & Alerting', description: 'Datadog/New Relic setup, custom dashboards, PagerDuty', type: 'task', status: 'backlog', priority: 'high', estimatedHours: 16, estimatedPoints: 5, actualHours: null },
    { title: 'Load Testing', description: 'k6 load tests for checkout flow, search, API endpoints', type: 'task', status: 'backlog', priority: 'medium', estimatedHours: 12, estimatedPoints: 5, actualHours: null },
    { title: 'Database Optimization', description: 'Query optimization, index tuning, connection pooling', type: 'task', status: 'backlog', priority: 'high', estimatedHours: 20, estimatedPoints: 8, actualHours: null },

    // Bugs
    { title: 'Fix: Cart total rounding error', description: 'Floating point issue causing 1 cent discrepancy', type: 'bug', status: 'todo', priority: 'high', estimatedHours: 4, estimatedPoints: 2, actualHours: null },
    { title: 'Fix: Product image upload fails on Safari', description: 'HEIC format not handled, need conversion', type: 'bug', status: 'todo', priority: 'medium', estimatedHours: 6, estimatedPoints: 3, actualHours: null },
    { title: 'Fix: Search returns stale results after update', description: 'Elasticsearch index not syncing on product update', type: 'bug', status: 'backlog', priority: 'high', estimatedHours: 8, estimatedPoints: 3, actualHours: null },
  ];

  for (const t of taskData) {
    await db.insert(tasks).values({
      projectId: project.id,
      title: t.title,
      description: t.description,
      type: t.type,
      status: t.status,
      priority: t.priority,
      estimatedHours: t.estimatedHours,
      estimatedPoints: t.estimatedPoints,
      actualHours: t.actualHours,
    });
  }

  console.log(`Created ${taskData.length} tasks for project: ${project.name}`);
  console.log(`Total estimated hours: ${taskData.reduce((s, t) => s + t.estimatedHours, 0)}`);
  console.log(`Project ID: ${project.id}`);
  console.log('\nSeed demo complete!');
  process.exit(0);
}

seedDemo().catch((err: unknown) => {
  console.error('Seed demo failed:', err);
  process.exit(1);
});
