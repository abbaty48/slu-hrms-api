import fastifyPlugin from "fastify-plugin"; // install fastify-plugin
import cors from "@fastify/cors"; // install @fastify/cors

/**
 * Explicitly whitelist origins (avoid '*') and support a short dev mode whitelist.
 * Allow credentials only when provided.
 * Specify allowed methods/headers and exposed headers.
 * Cache preflight responses with a reasonable maxAge.
 * Load rules from env vars so behavior is configurable per environment.
 * Fail fast on disallowed origins (return proper response).
 */
export default fastifyPlugin(async (fastify) => {
  const {
    CORS_ORIGINS,
    CORS_METHODS,
    CORS_ALLOW_HEADERS,
    CORS_EXPOSE_HEADERS,
    CORS_ALLOW_CREDENTIALS,
    CORS_PREFLIGHT_MAX_AGE, // 24h in seconds
  } = fastify.env;

  const origins = CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true; // server-to-server / no-origin
    if (origins.includes("*")) return true; // wildcard allow-all
    if (origins.includes(origin)) return true; // exact match
    return origins.some(
      // *.example.com wildcard
      (o) => o.startsWith("*.") && origin.endsWith(o.slice(1)),
    );
  }

  await fastify.register(cors, {
    origin: (origin, cb) => {
      fastify.log.info({ origin, allowed: origins }, "cors: origin check");
      if (isOriginAllowed(origin)) return cb(null, true);
      cb(new Error("CORS: origin not allowed"), false);
    },
    credentials: CORS_ALLOW_CREDENTIALS === "true",
    methods: CORS_METHODS.split(",").map((m) => m.trim()),
    maxAge: Number.parseInt(CORS_PREFLIGHT_MAX_AGE, 10) || 0,
    allowedHeaders: CORS_ALLOW_HEADERS.split(",").map((h) => h.trim()),
    exposedHeaders: CORS_EXPOSE_HEADERS
      ? CORS_EXPOSE_HEADERS.split(",").map((h) => h.trim())
      : [],
  });

  fastify.log.info("cors: plugin initialized.");
});
