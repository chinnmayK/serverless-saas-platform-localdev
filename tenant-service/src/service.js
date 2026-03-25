const repo = require("./repository");
const logger = require("@saas/shared/utils/logger");

async function generateUniqueSlug(name) {
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await repo.getTenantBySlug(slug);
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

async function createTenant(data) {
  if (!data.name || data.name.trim() === "") {
    throw new Error("Tenant name is required");
  }
  const name = data.name.trim();
  
  const validPlans = ["free", "pro", "enterprise"];
  if (data.plan && !validPlans.includes(data.plan)) {
    throw new Error(`Plan must be one of: ${validPlans.join(", ")}`);
  }

  // Generate unique slug with a few retries for race conditions
  let retries = 3;
  while (retries--) {
    try {
      const slug = await generateUniqueSlug(name);
      console.log(`[service] Creating tenant with name: ${name}, slug: ${slug}`);
      return await repo.createTenant({ name, slug, plan: data.plan });
    } catch (err) {
      if (err.code === "23505" && retries > 0) { // Unique violation
        console.warn(`Slug collision detected, retrying... (${retries} left)`);
        continue;
      }
      throw err;
    }
  }
}

async function listTenants() {
  return repo.getAllTenants();
}

async function getTenant(tenantId) {
  const tenant = await repo.getTenantById(tenantId);
  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}

async function upgradePlan(tenantId, plan) {
  const validPlans = ["free", "pro", "enterprise"];
  if (!validPlans.includes(plan)) {
    throw new Error(`Plan must be one of: ${validPlans.join(", ")}`);
  }
  
  // Get current plan for audit logging
  const currentTenant = await repo.getTenantById(tenantId);
  if (!currentTenant) throw new Error("Tenant not found");
  const oldPlan = currentTenant.plan;
  
  const tenant = await repo.updateTenantPlan(tenantId, plan);
  if (!tenant) throw new Error("Tenant not found");
  
  // Audit log the plan change
  logger.audit("tenant.plan_changed", { tenantId, oldPlan, newPlan: plan });
  
  return tenant;
}

async function getFeatures(tenantId) {
  return repo.getTenantFeatures(tenantId);
}

async function removeTenant(tenantId) {
  const tenant = await repo.deleteTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}

module.exports = { createTenant, listTenants, getTenant, upgradePlan, getFeatures, removeTenant };
