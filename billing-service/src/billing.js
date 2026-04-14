const stripe = require('./stripeClient');
const db = require('@saas/shared/utils/db');

/**
 * Create or retrieve a Stripe customer for a tenant.
 */
async function ensureStripeCustomer(tenantId, email, name) {
  const { rows } = await db.query(
    'SELECT stripe_customer_id FROM tenants WHERE tenant_id = $1',
    [tenantId]
  );
  if (!rows.length) throw new Error('Tenant not found');

  if (rows[0].stripe_customer_id) return rows[0].stripe_customer_id;

  const customer = await stripe.customers.create({ email, name, metadata: { tenantId } });

  await db.query(
    'UPDATE tenants SET stripe_customer_id = $1 WHERE tenant_id = $2',
    [customer.id, tenantId]
  );
  return customer.id;
}

/**
 * Create a Stripe Checkout session for the Pro plan.
 */
async function createCheckoutSession(tenantId, email, name) {
  const customerId = await ensureStripeCustomer(tenantId, email, name);

  const { rows: planRows } = await db.query(
    "SELECT stripe_price_id FROM plans WHERE id = 'pro'"
  );
  if (!planRows[0]?.stripe_price_id) throw new Error('Pro plan price not configured');

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: planRows[0].stripe_price_id, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.FRONTEND_URL}/billing/cancel`,
    metadata: { tenantId },
  });
  return session.url;
}

/**
 * Create a Stripe Customer Portal session (manage/cancel subscription).
 */
async function createPortalSession(tenantId) {
  const { rows } = await db.query(
    'SELECT stripe_customer_id FROM tenants WHERE tenant_id = $1',
    [tenantId]
  );
  if (!rows[0]?.stripe_customer_id) throw new Error('No Stripe customer found');

  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/dashboard`,
  });
  return session.url;
}

/**
 * Handle Stripe webhook events — keep this idempotent.
 */
async function handleWebhook(rawBody, signature) {
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'invoice.paid': {
      const sub = event.data.object;
      await db.query(
        `UPDATE tenants
            SET plan = 'pro', plan_status = 'active',
                stripe_subscription_id = $1
          WHERE stripe_customer_id = $2`,
        [sub.subscription, sub.customer]
      );
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const plan = sub.status === 'active' ? 'pro' : 'free';
      await db.query(
        `UPDATE tenants
            SET plan = $1, plan_status = $2
          WHERE stripe_customer_id = $3`,
        [plan, sub.status, sub.customer]
      );
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await db.query(
        `UPDATE tenants
            SET plan = 'free', plan_status = 'canceled',
                stripe_subscription_id = NULL
          WHERE stripe_customer_id = $1`,
        [sub.customer]
      );
      break;
    }
  }
  return { received: true };
}

module.exports = { ensureStripeCustomer, createCheckoutSession, createPortalSession, handleWebhook };

