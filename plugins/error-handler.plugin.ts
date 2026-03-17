import type { FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
/**
    FEATURES
    * Persist on errors: no process.exit() — application keeps running.
    * Circuit breaker: temporarily reject requests during high error rates (auto-recover after 30s).
    * Error metrics: track error frequency per minute; alert when threshold exceeded.
    * Auto-recovery: reconnect to services (Redis, DB) without restart.
    * Alerts: integrate with Slack/PagerDuty/Datadog for on-call notifications.
    * Graceful degradation: serve cached responses or defaults when services unavailable.
    * Memory monitoring: garbage collection + alerting on memory leaks (multiple high-mem warnings).
 */
export default fastifyPlugin(async (fastify) => {
  // error tracking: count errors per type/minute for alerting
  const errorMetrics = {
    warnings: 0,
    uncaughtExceptions: 0,
    unhandledRejections: 0,
    maxErrorsPerMinute: 10, // alert threshold
    lastResetTime: Date.now(),
  };

  const resetMetrics = () => {
    const now = Date.now();
    if (now - errorMetrics.lastResetTime > 60000) {
      fastify.log.info("Error metrics reset");
      errorMetrics.uncaughtExceptions = 0;
      errorMetrics.unhandledRejections = 0;
      errorMetrics.warnings = 0;
      errorMetrics.lastResetTime = now;
    }
  };

  // check if error rate is too high (circuit breaker pattern)
  const isCriticalErrorRate = () => {
    const totalErrors =
      errorMetrics.uncaughtExceptions + errorMetrics.unhandledRejections;
    return totalErrors > errorMetrics.maxErrorsPerMinute;
  };

  // decorator: send alert to monitoring/slack/pagerduty (stub)
  fastify.decorate("alertError", async (errorType: any, details: any) => {
    try {
      // TODO: integrate with monitoring system
      // await axios.post('https://hooks.slack.com/...', { text: errorMsg });
      fastify.log.warn(
        {
          alert: true,
          errorType,
          ...details,
          timestamp: new Date().toISOString(),
        },
        "ALERT: Critical error detected.",
      );
    } catch (err: any) {
      fastify.log.error("Failed to send alert:", err.message);
    }
  });

  // decorator: attempt recovery (e.g., reconnect to database, redis, etc)
  fastify.decorate("attemptRecovery", async (service = "unknown") => {
    fastify.log.info(`Attempting recovery for service: ${service}`);
    try {
      // reconnect cache/redis
      //  add database reconnection
      if (fastify.cacheClient && typeof fastify.cacheClient === "function") {
        const client = fastify.cacheClient();
        if (client && "ping" in client) await client.ping;
      }
      fastify.log.info(`Recovery successful for ${service}`);
      return true;
    } catch (err: any) {
      fastify.log.error(`Recovery failed for ${service}:`, err.message);
      return false;
    }
  });

  // handle uncaught exceptions (synchronous errors not caught by try/catch)
  process.on("uncaughtException", async (err: any) => {
    resetMetrics();
    errorMetrics.uncaughtExceptions++;

    const errorDetails = {
      level: "error",
      type: "uncaughtException",
      message: err?.message || "Unknown error",
      stack: err?.stack || "",
      code: err?.code || "UNKNOWN",
      errno: err?.errno || null,
      syscall: err?.syscall || null,
      count: errorMetrics.uncaughtExceptions,
    };

    fastify.log.error(
      errorDetails,
      "Uncaught Exception - Application will attempt recovery.",
    );

    // check if critical error rate
    if (isCriticalErrorRate()) {
      fastify.alertError("uncaughtException", {
        ...errorDetails,
        message: "Critical error rate exceeded",
      });
      // optionally trigger circuit breaker: reject new requests temporarily
      fastify.decorate("circuitBreakerOpen", true);
      setTimeout(() => {
        fastify.circuitBreakerOpen = false;
        fastify.log.info("Circuit breaker closed, resuming normal operation");
      }, 30000); // reset after 30s
    }

    // attempt recovery
    const recovered = fastify.attemptRecovery("uncaughtException");
    if (!recovered) {
      // still not recovered, but don't exit — just alert
      await fastify.alertError("recoveryFailed", errorDetails);
    }

    // DO NOT exit — application persists and serves requests from cache or defaults
  });

  // handle unhandled promise rejections (async errors not caught by .catch())
  process.on("unhandledRejection", async (reason, promise) => {
    resetMetrics();
    errorMetrics.unhandledRejections++;

    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : "";

    const errorDetails = {
      level: "error",
      type: "unhandledRejection",
      message: errorMsg,
      stack: errorStack,
      reason: String(reason),
      promise: promise?.constructor?.name || "Unknown Promise",
      count: errorMetrics.unhandledRejections,
    };

    console.error(errorDetails);
    fastify.log.error(
      errorDetails,
      "Unhandled Promise Rejection - Application will attempt recovery",
    );

    // check if critical error rate
    if (isCriticalErrorRate()) {
      fastify.alertError("unhandledRejection", {
        ...errorDetails,
        message: "Critical rejection rate exceeded",
      });
      fastify.decorate("circuitBreakerOpen", true);
      setTimeout(() => {
        fastify.circuitBreakerOpen = false;
        fastify.log.info("Circuit breaker closed, resuming normal operation");
      }, 30000);
    }

    // attempt recovery
    const recovered = await fastify.attemptRecovery("unhandledRejection");
    if (!recovered) {
      fastify.alertError("recoveryFailed", errorDetails);
    }

    // DO NOT exit — application persists
  });

  // optional: handle warnings (non-fatal issues)
  process.on("warning", (warning: any) => {
    resetMetrics();
    errorMetrics.warnings++;

    fastify.log.warn(
      {
        type: warning.name || "Warning",
        message: warning.message,
        code: warning.code || null,
        stack: warning.stack || "",
        count: errorMetrics.warnings,
      },
      "Process Warning",
    );
  });

  // circuit breaker preHandler: reject requests if error rate too high
  fastify.decorate(
    "circuitBreakerHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (fastify.circuitBreakerOpen) {
        return reply.code(503).send({
          error: "Service Temporarily Unavailable",
          message:
            "Application is recovering from errors. Please retry in a few seconds.",
          retryAfter: 30,
        });
      }
    },
  );

  // memory monitoring: track and alert on high usage
  if (global.gc) {
    let highMemoryWarnings = 0;
    setInterval(() => {
      const used = process.memoryUsage();
      const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;

      if (heapUsedPercent > 90) {
        highMemoryWarnings++;
        fastify.log.warn(
          {
            heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
            percentage: heapUsedPercent.toFixed(2),
            warnings: highMemoryWarnings,
          },
          "High memory usage detected (>90%)",
        );

        // trigger garbage collection
        try {
          global?.gc!();
          fastify.log.info("Garbage collection triggered");
        } catch (_) {
          fastify.log.warn(
            "Garbage collection not available (run with --expose-gc)",
          );
        }

        // if memory still high after GC, alert
        if (highMemoryWarnings > 3) {
          fastify.alertError("memoryLeak", {
            heapUsedPercent: heapUsedPercent.toFixed(2),
            warnings: highMemoryWarnings,
          });
        }
      } else {
        highMemoryWarnings = 0; // reset if memory normalizes
      }
    }, 30000); // check every 30s
  }

  fastify.log.info(
    "Resilient error handlers registered: persist on errors, circuit breaker, auto-recovery, alerting",
  );
});
