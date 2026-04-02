const jwt = require("jsonwebtoken");
const response = require("../utils/response");

const JWT_SECRET = process.env.JWT_SECRET || "local_dev_jwt_secret_change_in_prod";

// 🔥 CPU WIN: JWT DECODE CACHE
const jwtCache = new Map();
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function decodeCached(token) {
  const now = Date.now();
  const cached = jwtCache.get(token);

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.decoded;
  }

  const decoded = jwt.verify(token, JWT_SECRET);

  // Evict if cache is full
  if (jwtCache.size >= MAX_CACHE_SIZE) {
    const firstKey = jwtCache.keys().next().value;
    jwtCache.delete(firstKey);
  }

  jwtCache.set(token, { decoded, timestamp: now });
  return decoded;
}

module.exports = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return response.unauthorized(res, "Missing or invalid Authorization header");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = decodeCached(token);
    req.user = decoded;
    next();
  } catch (err) {
    return response.unauthorized(res, "Invalid or expired token");
  }
};

