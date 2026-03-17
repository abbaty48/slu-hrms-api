import type { FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { LRUCache } from "lru-cache";
import IORedis from "ioredis";

const DEFAULT_TTL = 60;

export default fastifyPlugin(async (fastify) => {
  const {
    DEFAULT_CACHE_TTL = String(DEFAULT_TTL),
    REDIS_URL = "redis://127.0.0.1:6379",
    CACHE_DRIVER = "memory",
    LRU_MAX = "5000",
  } = fastify.env;

  const ttl = Math.max(
    1,
    Number.parseInt(DEFAULT_CACHE_TTL, 10) || DEFAULT_TTL,
  );
  const lruMax = Math.max(100, Number.parseInt(LRU_MAX, 10) || 5000);
  // Start with an in-memory LRU so plugin never blocks startup
  let client = new LRUCache({ max: lruMax });
  let isRedis = String(CACHE_DRIVER).toLowerCase() === "redis";

  fastify.log.info(
    `cache: init (preferred=${CACHE_DRIVER}, redisUrl=${REDIS_URL})`,
  );
  // Attempt background redis connect only if requested
  if (isRedis) {
    const redis = new IORedis.Redis(REDIS_URL, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });

    redis.on("error", (err: any) => {
      fastify.log.debug("redis client error:", err && err.message);
      fastify.log.warn(
        "cache: redis connect failed (will continue using memory LRU):",
        err && err.message,
      );
      try {
        redis.disconnect();
      } catch (_) {}
    });
    redis.on("connect", () => {
      fastify.log.info("redis: connect event");
      // client = redis;
      isRedis = true;
      fastify.log.info(
        "cache: connected to redis, using redis as cache backend",
      );
    });
    redis.on("ready", () => fastify.log.debug("redis: ready event"));
  } else {
    fastify.log.info("cache: using in-memory LRU (no redis requested)");
  }

  // helper key generator: method + url + sorted query + optional vary headers
  function makeKey(request: any, extra = "") {
    const url =
      request.routerPath ||
      request.url ||
      (request.raw && request.raw.url) ||
      "";
    const q = request.query
      ? Object.keys(request.query)
          .sort()
          .map((k) => `${k}=${request.query[k]}`)
          .join("&")
      : "";
    return `cache:${request.method}:${url}?${q}:${extra}`;
  }

  // getter / setter adaptors for redis vs LRU (check isRedis at call-time)
  async function getCached(key: any) {
    if (isRedis) {
      const val = client.get(key);
      return val ? (val as {}) : null;
    }
    return client.get(key) ?? null;
  }
  //
  async function setCached(key: any, value: any, ttlSec = ttl) {
    if (isRedis) {
      client.set(key, JSON.stringify(value), {
        ttl: Math.max(1, Math.floor(ttlSec)),
      });
      return;
    }
    client.set(key, value, { ttl: ttlSec * 1000 });
  }
  //
  async function delCached(key: any) {
    if (isRedis) {
      client.delete(key);
      return;
    }
    client.delete(key);
  }

  // expose client + helpers
  fastify.decorate("cacheClient", () => client); // return current backend
  fastify.decorate("cacheGet", getCached);
  fastify.decorate("cacheSet", setCached);
  fastify.decorate("cacheDel", delCached);
  fastify.decorate("cacheKeyFor", makeKey);

  // preHandler factory
  fastify.decorate(
    "cachePreHandler",
    function ({ ttl: customTtl = ttl, keyPrefix = "" } = {}) {
      return async function cachePreHandler(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        if (request.method === "OPTIONS") return;
        const key = makeKey(request, keyPrefix);
        const cached = (await getCached(key)) as any;
        if (!cached) return;
        if (cached.status && cached.payload) {
          for (const [h, v] of Object.entries(cached.headers || {}))
            reply.header(h, v);
          reply.status(cached.status).send(cached.payload);
          return reply;
        }
        reply.header("x-cache", "HIT");
        reply.header("Cache-Control", `public, max-age=${customTtl}`);
        reply.send(cached);
        return reply;
      };
    },
  );

  fastify.decorate(
    "cacheResponse",
    async function (
      request: FastifyRequest,
      reply: FastifyReply,
      payload: any,
      { ttl: customTtl = ttl, keyPrefix = "" } = {},
    ) {
      try {
        const key = makeKey(request, keyPrefix);
        const store = {
          status: reply.statusCode || 200,
          headers: reply.getHeaders ? reply.getHeaders() : {},
          payload,
        };
        await setCached(key, store, customTtl);
      } catch (err: any) {
        fastify.log.warn("cacheResponse error", err && err.message);
      }
    },
  );

  fastify.addHook("onClose", async () => {
    if (isRedis && client) {
      try {
        client.dispose;
      } catch (err: any) {
        fastify.log.warn("cache: redis quit error", err && err.message);
      }
    }
  });

  fastify.log.info(
    `cache: plugin initialized (backend=${isRedis ? "redis" : "memory"}, ttl=${ttl}s)`,
  );
  return;
});
