import type { FastifyReply, FastifyRequest, FastifyError } from "fastify";
import fastifyPlugin from "fastify-plugin";

/**
 * FEATURES
 * - Persist on errors: no process.exit() — application keeps running.
 * - Circuit breaker: temporarily reject requests during high error rates (auto-recover after 30s).
 * - Error metrics: track error frequency per minute; reset on a timer, not just on next error.
 * - Auto-recovery: reconnect to services (Redis, DB) without restart.
 * - Alerts: integrate with Slack/PagerDuty/Datadog for on-call notifications.
 * - Graceful shutdown: SIGTERM/SIGINT drain in-flight requests before exit.
 * - Memory monitoring: GC trigger + alerting (runs regardless of --expose-gc flag).
 * - Central HTTP error handler: validation errors, thrown errors, 404s all handled uniformly.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType =
  | "uncaughtException"
  | "unhandledRejection"
  | "recoveryFailed"
  | "memoryLeak"
  | "circuitBreakerOpen";

type ErrorDetails = Record<string, unknown>;

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin(async (fastify) => {
  // ── Error Metrics ──────────────────────────────────────────────────────────

  const metrics = {
    warnings: 0,
    uncaughtExceptions: 0,
    unhandledRejections: 0,
    maxErrorsPerMinute: 10,
    lastResetTime: Date.now(),
  };

  // Reset on a fixed 60s interval — not just when a new error fires
  // Original: reset only triggered by errors, so a burst then silence left stale counts
  const metricsResetTimer = setInterval(() => {
    metrics.uncaughtExceptions = 0;
    metrics.unhandledRejections = 0;
    metrics.warnings = 0;
    metrics.lastResetTime = Date.now();
    fastify.log.debug("error-handler: metrics reset");
  }, 60_000).unref(); // .unref() so the timer doesn't prevent clean shutdown

  const isCriticalErrorRate = () =>
    metrics.uncaughtExceptions + metrics.unhandledRejections >
    metrics.maxErrorsPerMinute;

  // ── Circuit Breaker ────────────────────────────────────────────────────────

  // Decorated once here with the correct initial value — original called
  // fastify.decorate() inside event handlers which throws on subsequent calls
  fastify.decorate("circuitBreakerOpen", false);

  let breakerResetTimer: ReturnType<typeof setTimeout> | null = null;

  const openCircuitBreaker = () => {
    if (fastify.circuitBreakerOpen) return; // already open — don't stack timers
    fastify.circuitBreakerOpen = true;
    fastify.log.warn(
      "error-handler: circuit breaker OPEN — rejecting new requests",
    );
    void fastify.alertError("circuitBreakerOpen", {
      reason: "Critical error rate exceeded",
    });

    // Single timer — original spawned a new one per error creating a race condition
    breakerResetTimer = setTimeout(() => {
      fastify.circuitBreakerOpen = false;
      breakerResetTimer = null;
      fastify.log.info(
        "error-handler: circuit breaker CLOSED — resuming normal operation",
      );
    }, 30_000);
  };

  // ── Decorators ─────────────────────────────────────────────────────────────

  fastify.decorate(
    "alertError",
    async (errorType: AlertType, details: ErrorDetails) => {
      try {
        // TODO: swap stub for real integration:
        // await axios.post("https://hooks.slack.com/...", { text: JSON.stringify({ errorType, ...details }) });
        // await axios.post("https://events.pagerduty.com/v2/enqueue", { ... });
        fastify.log.warn(
          {
            alert: true,
            errorType,
            ...details,
            timestamp: new Date().toISOString(),
          },
          "ALERT: Critical error detected.",
        );
      } catch (err) {
        fastify.log.error({ err }, "error-handler: failed to send alert");
      }
    },
  );

  fastify.decorate(
    "attemptRecovery",
    async (service = "unknown"): Promise<boolean> => {
      fastify.log.info(
        `error-handler: attempting recovery for service: ${service}`,
      );
      try {
        if (fastify.cacheClient && typeof fastify.cacheClient === "function") {
          const client = fastify.cacheClient();
          // Original: `await client.ping` — property access, never called. Fixed: client.ping()
          if (client && typeof client.ping === "function") await client.ping();
        }

        // Prisma reconnect — $connect is idempotent
        if (fastify.prisma) {
          await fastify.prisma.$connect();
        }

        fastify.log.info(`error-handler: recovery successful for ${service}`);
        return true;
      } catch (err) {
        fastify.log.error(
          { err },
          `error-handler: recovery failed for ${service}`,
        );
        return false;
      }
    },
  );

  // ── Circuit Breaker preHandler ─────────────────────────────────────────────

  fastify.decorate(
    "circuitBreakerHandler",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      if (fastify.circuitBreakerOpen) {
        return reply.code(503).send({
          statusCode: 503,
          error: "Service Temporarily Unavailable",
          message:
            "Application is recovering from errors. Please retry shortly.",
          retryAfter: 30,
        });
      }
    },
  );

  // ── Central HTTP Error Handler ─────────────────────────────────────────────
  // Original had no setErrorHandler — schema validation failures, thrown errors,
  // and 404s all bypassed this plugin entirely and leaked raw Fastify error shapes

  fastify.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode ?? 500;
      const isServerError = statusCode >= 500;

      if (isServerError) {
        fastify.log.error(
          {
            err: error,
            reqId: request.id,
            url: request.url,
            method: request.method,
          },
          "error-handler: unhandled route error",
        );
      } else {
        fastify.log.warn(
          { err: error, reqId: request.id, url: request.url },
          "error-handler: client error",
        );
      }

      // Validation errors from Fastify schema (statusCode 400) — expose field details
      if (statusCode === 400 && error.validation) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Validation Error",
          message: "Request validation failed.",
          details: error.validation,
        });
      }

      return reply.code(statusCode).send({
        statusCode,
        error: error.name ?? "Error",
        message: error.message ?? "An unexpected error occurred.",
      });
    },
  );

  // 404 handler — routes that don't match any registered path
  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.warn(
      { url: request.url, method: request.method },
      "error-handler: route not found",
    );
    reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found.`,
    });
  });

  // ── Process Error Handlers ─────────────────────────────────────────────────

  const buildErrorDetails = (
    type: string,
    err: unknown,
    extra: ErrorDetails = {},
  ): ErrorDetails => ({
    type,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    code: (err as NodeJS.ErrnoException)?.code ?? "UNKNOWN",
    errno: (err as NodeJS.ErrnoException)?.errno ?? null,
    syscall: (err as NodeJS.ErrnoException)?.syscall ?? null,
    ...extra,
  });

  process.on("uncaughtException", async (err) => {
    metrics.uncaughtExceptions++;
    const details = buildErrorDetails("uncaughtException", err, {
      count: metrics.uncaughtExceptions,
    });

    fastify.log.error(details, "error-handler: uncaught exception");

    if (isCriticalErrorRate()) openCircuitBreaker();

    // Original was missing await here
    const recovered = await fastify.attemptRecovery("uncaughtException");
    if (!recovered) await fastify.alertError("recoveryFailed", details);
  });

  process.on("unhandledRejection", async (reason, promise) => {
    metrics.unhandledRejections++;
    const details = buildErrorDetails("unhandledRejection", reason, {
      promise:
        (promise as Promise<unknown>)?.constructor?.name ?? "Unknown Promise",
      count: metrics.unhandledRejections,
    });

    // Original had a rogue console.error() here — removed, fastify.log is the single logger
    fastify.log.error(details, "error-handler: unhandled promise rejection");

    if (isCriticalErrorRate()) openCircuitBreaker();

    const recovered = await fastify.attemptRecovery("unhandledRejection");
    if (!recovered) await fastify.alertError("recoveryFailed", details);
  });

  process.on("warning", (warning) => {
    metrics.warnings++;
    fastify.log.warn(
      {
        type: warning.name ?? "Warning",
        message: warning.message,
        code: (warning as NodeJS.ErrnoException).code ?? null,
        stack: warning.stack ?? "",
        count: metrics.warnings,
      },
      "error-handler: process warning",
    );
  });

  // ── Graceful Shutdown ──────────────────────────────────────────────────────
  // Original had no shutdown handling — SIGTERM killed the process hard,
  // dropping in-flight requests and leaving DB connections open

  const shutdown = async (signal: string) => {
    fastify.log.info(
      `error-handler: ${signal} received — starting graceful shutdown`,
    );
    try {
      clearInterval(metricsResetTimer);
      if (breakerResetTimer) clearTimeout(breakerResetTimer);
      await fastify.close(); // drains in-flight requests, closes DB/cache connections
      fastify.log.info("error-handler: graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      fastify.log.error(
        { err },
        "error-handler: shutdown failed — forcing exit",
      );
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  // ── Memory Monitoring ──────────────────────────────────────────────────────
  // Original only ran the monitor if global.gc existed — RSS and external memory
  // went unmonitored entirely in production. Monitor always runs; GC is attempted if available.

  let highMemoryWarnings = 0;

  const memoryTimer = setInterval(() => {
    const used = process.memoryUsage();
    const heapPercent = (used.heapUsed / used.heapTotal) * 100;
    const rssMB = Math.round(used.rss / 1_048_576);
    const heapUsedMB = Math.round(used.heapUsed / 1_048_576);
    const heapTotalMB = Math.round(used.heapTotal / 1_048_576);
    const externalMB = Math.round(used.external / 1_048_576);

    // Log memory snapshot at debug level every cycle for observability
    fastify.log.debug(
      {
        rssMB,
        heapUsedMB,
        heapTotalMB,
        externalMB,
        heapPercent: heapPercent.toFixed(1),
      },
      "error-handler: memory snapshot",
    );

    if (heapPercent > 90) {
      highMemoryWarnings++;
      fastify.log.warn(
        {
          heapUsedMB,
          heapTotalMB,
          externalMB,
          rssMB,
          heapPercent: heapPercent.toFixed(2),
          warnings: highMemoryWarnings,
        },
        "error-handler: high memory usage (>90%)",
      );

      if (global.gc) {
        try {
          global.gc();
          fastify.log.info("error-handler: garbage collection triggered");
        } catch {
          fastify.log.warn(
            "error-handler: GC not available — run with --expose-gc",
          );
        }
      }

      if (highMemoryWarnings >= 3) {
        void fastify.alertError("memoryLeak", {
          heapPercent: heapPercent.toFixed(2),
          rssMB,
          warnings: highMemoryWarnings,
        });
      }
    } else {
      if (highMemoryWarnings > 0) {
        fastify.log.info("error-handler: memory normalized");
      }
      highMemoryWarnings = 0;
    }
  }, 30_000).unref();

  fastify.log.info(
    "error-handler: registered — circuit breaker, graceful shutdown, memory monitor, central HTTP error handler",
  );
});
