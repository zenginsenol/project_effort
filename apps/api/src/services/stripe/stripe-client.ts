import Stripe from 'stripe';

export class StripeService {
  private client: Stripe | null = null;

  private getClient(): Stripe {
    if (!this.client) {
      const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
      if (!apiKey) {
        throw new Error('STRIPE_SECRET_KEY is required');
      }
      this.client = new Stripe(apiKey, {
        apiVersion: '2024-12-18.acacia',
        typescript: true,
      });
    }
    return this.client;
  }

  async createCustomer(params: {
    email: string;
    name: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    const stripe = this.getClient();
    return stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
  }

  async createSubscription(params: {
    customerId: string;
    priceId: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
    const stripe = this.getClient();
    return stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      metadata: params.metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
  }

  async updateSubscription(
    subscriptionId: string,
    params: {
      priceId?: string;
      metadata?: Record<string, string>;
      cancelAtPeriodEnd?: boolean;
    },
  ): Promise<Stripe.Subscription> {
    const stripe = this.getClient();
    const updateData: Stripe.SubscriptionUpdateParams = {
      metadata: params.metadata,
      cancel_at_period_end: params.cancelAtPeriodEnd,
    };

    if (params.priceId) {
      updateData.items = [{ price: params.priceId }];
    }

    return stripe.subscriptions.update(subscriptionId, updateData);
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately = false,
  ): Promise<Stripe.Subscription> {
    const stripe = this.getClient();
    if (cancelImmediately) {
      return stripe.subscriptions.cancel(subscriptionId);
    }
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async createCheckoutSession(params: {
    customerId?: string;
    customerEmail?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    const stripe = this.getClient();
    return stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      customer_email: params.customerEmail,
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_types: ['card'],
    });
  }

  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    const stripe = this.getClient();
    return stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = this.getClient();
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  async listInvoices(params: {
    customerId: string;
    limit?: number;
  }): Promise<Stripe.ApiList<Stripe.Invoice>> {
    const stripe = this.getClient();
    return stripe.invoices.list({
      customer: params.customerId,
      limit: params.limit ?? 10,
    });
  }

  async retrieveCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    const stripe = this.getClient();
    return stripe.customers.retrieve(customerId);
  }

  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const stripe = this.getClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required for webhook verification');
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}

export const stripeService = new StripeService();
