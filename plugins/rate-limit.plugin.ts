import fastifyPlugin from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

export default fastifyPlugin(async (fastify) => {
  const {
    RATE_LIMIT_MAX = "100", // requests per window
    RATE_LIMIT_TIMEWINDOW = "15 minutes", // time window
    RATE_LIMIT_SKIP_ON_ERROR = "true", // don't reject if rate-limit service fails
  } = fastify.env;

  const maxRequests = Number.parseInt(RATE_LIMIT_MAX, 10) || 100;
  // if no redis or not requested, rate-limit will use built-in memory store

  await fastify.register(rateLimit, {
    max: maxRequests,
    timeWindow: RATE_LIMIT_TIMEWINDOW,
    skipOnError: String(RATE_LIMIT_SKIP_ON_ERROR).toLowerCase() === "true",
    keyGenerator: (request) => {
      // rate limit by IP (or X-Forwarded-For if behind proxy)
      return (request.headers["x-forwarded-for"] ||
        request.headers["x-real-ip"] ||
        request.ip ||
        "unknown") as string;
    },
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      retryAfter: context.after,
      message: `Rate limit exceeded. Max ${context.max} requests per ${context.ban}.`,
    }),
    allowList: (request) => {
      // whitelist health checks, metrics, or internal IPs
      const healthPaths = ["/health", "/metrics", "/live", "/logs"];
      if (healthPaths.includes(request.url)) return true;

      // optional: whitelist internal/private IPs

      const internalIPs = ["127.0.0.1", "::1"];
      const clientIP =
        request.headers["x-forwarded-for"] ||
        request.headers["x-real-ip"] ||
        request.ip;
      if (typeof clientIP === "string") {
        if (internalIPs.includes(clientIP)) return true;
      } else {
        if (internalIPs.includes(clientIP[0]!)) return true;
      }

      return false;
    },
  });

  fastify.log.info(
    `rate-limit: initialized (max=${maxRequests}, window=${RATE_LIMIT_TIMEWINDOW})`,
  );
});
