const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("@saas/shared/utils/logger");
const repo = require("./repository");
const { getRedisClient } = require("@saas/shared/utils/redis");

const USER_CACHE_TTL = 300; // 5 minutes

const JWT_SECRET = process.env.JWT_SECRET || "local_dev_jwt_secret_change_in_prod";
const JWT_EXPIRES = "24h";

async function register({ tenantId, email, password, role }) {
  if (!tenantId || !email || !password) {
    throw new Error("tenantId, email, and password are required");
  }

  const existing = await repo.findUserByEmailForAuth(email);
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repo.createUser({ tenantId, email, passwordHash, role });
  return user;
}

async function login({ email, password }) {
  if (!email || !password) throw new Error("Email and password are required");

  const redis = await getRedisClient();
  const cacheKey = `user:email:${email}`;
  
  let user;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    logger.info("user.login.cache_hit", { email });
    user = JSON.parse(cached);
  } else {
    logger.info("user.login.cache_miss", { email });
    // Uses auth_user pool — bypasses RLS, safe because it's SELECT-only
    // and only returns data to the user who knows the correct password
    user = await repo.findUserByEmailForAuth(email);
    if (user) {
      await redis.setEx(cacheKey, USER_CACHE_TTL, JSON.stringify(user));
    }
  }

  if (!user) throw new Error("Invalid email or password");

  if (user.tenant_status !== "active") throw new Error("Tenant account is suspended");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid email or password");

  const token = jwt.sign(
    {
      userId: user.user_id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  // Log successful login
  logger.info("user.login", { userId: user.user_id, tenantId: user.tenant_id, email });

  return {
    token,
    user: {
      userId: user.user_id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    },
  };
}

async function listUsers(tenantId) {
  const users = await repo.getUsersByTenant(tenantId);
  // Transform to lightweight response
  return users.map(u => ({
    userId: u.user_id,
    tenantId: u.tenant_id,
    email: u.email,
    role: u.role,
    createdAt: u.created_at
  }));
}

async function getUser(userId, tenantId) {
  const redis = await getRedisClient();
  const cacheKey = `user:${userId}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    const user = JSON.parse(cached);
    // Extra safety: ensure tenantId matches
    if (user.tenantId === tenantId) {
      logger.info("user.get.cache_hit", { userId, tenantId });
      return user;
    }
  }

  logger.info("user.get.cache_miss", { userId, tenantId });
  const user = await repo.getUserById(userId, tenantId);
  if (!user) throw new Error("User not found");

  const userProfile = {
    userId: user.user_id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role,
    createdAt: user.created_at
  };

  // Cache it
  await redis.setEx(cacheKey, USER_CACHE_TTL, JSON.stringify(userProfile));
  return userProfile;
}

async function removeUser(userId, tenantId) {
  const user = await repo.deleteUser(userId, tenantId);
  if (!user) throw new Error("User not found");

  // Invalidate cache
  const redis = await getRedisClient();
  await Promise.all([
    redis.del(`user:${userId}`),
    redis.del(`user:email:${user.email}`)
  ]);

  return user;
}

module.exports = { register, login, listUsers, getUser, removeUser };
