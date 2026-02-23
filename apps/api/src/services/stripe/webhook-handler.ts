import Stripe from 'stripe';
import { eq, and } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { subscriptions, invoices, organizations } from '@estimate-pro/db/schema';

export class StripeWebhookHandler {
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Unhandled event type - log and ignore
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    // Extract metadata
    const organizationId = session.metadata?.organizationId;
    const plan = session.metadata?.plan as 'free' | 'pro' | 'enterprise';

    if (!organizationId || !plan) {
      throw new Error('Missing required metadata in checkout session');
    }

    // Get subscription details
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

    if (!subscriptionId || !customerId) {
      throw new Error('Missing subscription or customer ID in checkout session');
    }

    // Create subscription record in database
    await db.insert(subscriptions).values({
      organizationId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
    });

    // Update organization with Stripe customer ID and current plan
    await db
      .update(organizations)
      .set({
        stripeCustomerId: customerId,
        currentPlan: plan,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    // Find subscription in database by Stripe subscription ID
    const existingSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, subscription.id),
    });

    if (!existingSubscription) {
      // Subscription doesn't exist in our database yet - this might be a new subscription
      // or a subscription that was created outside of our checkout flow
      console.warn(`Subscription ${subscription.id} not found in database`);
      return;
    }

    // Extract plan from metadata or keep existing plan
    const plan = (subscription.metadata?.plan as 'free' | 'pro' | 'enterprise') ?? existingSubscription.plan;

    // Update subscription record
    await db
      .update(subscriptions)
      .set({
        plan,
        status: subscription.status as 'active' | 'canceled' | 'past_due' | 'incomplete',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSubscription.id));

    // Update organization current plan
    await db
      .update(organizations)
      .set({
        currentPlan: plan,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, existingSubscription.organizationId));
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Find subscription in database
    const existingSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, subscription.id),
    });

    if (!existingSubscription) {
      console.warn(`Subscription ${subscription.id} not found in database`);
      return;
    }

    // Mark subscription as canceled
    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSubscription.id));

    // Downgrade organization to free plan
    await db
      .update(organizations)
      .set({
        currentPlan: 'free',
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, existingSubscription.organizationId));
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Extract customer ID and find organization
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!customerId) {
      throw new Error('Missing customer ID in invoice');
    }

    // Find organization by Stripe customer ID
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.stripeCustomerId, customerId),
    });

    if (!organization) {
      console.warn(`Organization not found for Stripe customer ${customerId}`);
      return;
    }

    // Create invoice record in database
    await db.insert(invoices).values({
      organizationId: organization.id,
      stripeInvoiceId: invoice.id,
      amountPaid: (invoice.amount_paid / 100).toFixed(2), // Convert cents to dollars
      amountDue: (invoice.amount_due / 100).toFixed(2),
      currency: invoice.currency ?? 'usd',
      status: (invoice.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible') ?? 'paid',
      invoicePdf: invoice.invoice_pdf ?? null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      billingPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      billingPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Extract customer ID and find organization
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!customerId) {
      throw new Error('Missing customer ID in invoice');
    }

    // Find organization by Stripe customer ID
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.stripeCustomerId, customerId),
    });

    if (!organization) {
      console.warn(`Organization not found for Stripe customer ${customerId}`);
      return;
    }

    // Create/update invoice record with failed status
    await db.insert(invoices).values({
      organizationId: organization.id,
      stripeInvoiceId: invoice.id,
      amountPaid: (invoice.amount_paid / 100).toFixed(2),
      amountDue: (invoice.amount_due / 100).toFixed(2),
      currency: invoice.currency ?? 'usd',
      status: 'open', // Failed payments remain open
      invoicePdf: invoice.invoice_pdf ?? null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      billingPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      billingPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    });

    // TODO: Send notification to organization owner about failed payment
    // This could be implemented using an email service or notification system
    console.warn(`Payment failed for organization ${organization.id} (${organization.name})`);
  }
}

export const stripeWebhookHandler = new StripeWebhookHandler();
