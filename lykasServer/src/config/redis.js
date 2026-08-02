const { createClient } = require("redis");
const logger = require("../utils/logger");

let client = null;

/**
 * Connects to Redis once at boot. Used to back:
 *   - express-rate-limit stores (rate-limit-redis), so limits survive
 *     restarts and are shared across horizontally-scaled instances
 *   - response caching for hot public read endpoints (GET /api/pets,
 *     GET /api/announcements/active)
 *
 * This is the fix for the gap called out repeatedly in the spec: `redis`
 * was a declared dependency in the original source that was never
 * imported anywhere, so every rate limiter silently ran on an in-memory
 * store. If REDIS_URL is unset, we fail loudly rather than silently
 * falling back to in-memory again (that regression is exactly what we're
 * trying to prevent).
 */
async function connectRedis() {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set — required for rate limiting and caching");
  }

  client = createClient({ url });

  client.on("error", (err) => logger.error({ err }, "Redis client error"));
  client.on("connect", () => logger.info("Redis connected"));
  client.on("reconnecting", () => logger.warn("Redis reconnecting"));

  await client.connect();
  return client;
}

function getRedisClient() {
  if (!client) {
    throw new Error("Redis client requested before connectRedis() completed");
  }
  return client;
}

module.exports = { connectRedis, getRedisClient };
