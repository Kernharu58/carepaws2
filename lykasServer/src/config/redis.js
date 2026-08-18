const { createClient } = require("redis");
const logger = require("../utils/logger");

let client = null;
let resolveReady;
const readyPromise = new Promise((resolve) => {
  resolveReady = resolve;
});

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
  resolveReady(client);
  return client;
}

function getRedisClient() {
  if (!client) {
    throw new Error("Redis client requested before connectRedis() completed");
  }
  return client;
}

/**
 * Like getRedisClient(), but for consumers that are built (not just used)
 * before connectRedis() has resolved — e.g. rateLimitMiddleware.js, which
 * constructs its RedisStore instances at module-load time, well before
 * server.js's start() ever calls connectRedis(). Returns a promise that
 * only resolves once the client is actually connected, instead of
 * throwing immediately.
 */
function getRedisClientAsync() {
  return readyPromise;
}

module.exports = { connectRedis, getRedisClient, getRedisClientAsync };