/**
 * shared/utils/mapper.js
 * Utility to standardize database results (snake_case) into 
 * frontend-friendly JSON (camelCase).
 */

function mapTenant(t) {
  if (!t) return null;
  return {
    tenantId:            t.tenant_id,
    name:                t.name,
    slug:                t.slug,
    plan:                t.plan,
    status:              t.status,
    stripeCustomerId:    t.stripe_customer_id,
    stripeSubscriptionId: t.stripe_subscription_id,
    planStatus:          t.plan_status,
    onboardingCompleted: t.onboarding_completed,
    createdAt:           t.created_at,
    deletedAt:           t.deleted_at
  };
}

function mapUser(u) {
  if (!u) return null;
  return {
    userId:       u.user_id,
    tenantId:     u.tenant_id,
    email:        u.email,
    name:         u.name,
    role:         u.role,
    isAdmin:      u.is_admin,
    tenantStatus: u.tenant_status, // Joined from tenants
    plan:         u.plan,          // Joined from tenants
    createdAt:    u.created_at
  };
}

function mapFile(f) {
  if (!f) return null;
  return {
    fileId:       f.file_id,
    tenantId:     f.tenant_id,
    userId:       f.user_id,
    originalName: f.original_name,
    mimeType:     f.mime_type,
    sizeBytes:    f.size_bytes,
    createdAt:    f.created_at
  };
}

function mapSubscription(s) {
  if (!s) return null;
  return {
    subscriptionId: s.subscription_id,
    tenantId:       s.tenant_id,
    plan:           s.plan,
    status:         s.status,
    startedAt:      s.started_at,
    renewedAt:      s.renewed_at
  };
}

module.exports = {
  mapTenant,
  mapUser,
  mapFile,
  mapSubscription
};
