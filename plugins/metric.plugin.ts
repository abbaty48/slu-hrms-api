import {
  Gauge,
  Counter,
  Registry,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";
import fs from "node:fs";
import path from "node:path";
import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * METRICS PLUGIN
 * Exposes GET /metrics in Prometheus text format.
 *
 * Free visualization options (no Grafana Cloud needed):
 *   1. Self-hosted Grafana OSS + Prometheus  — full dashboards, zero cost
 *   2. Prometheus built-in expression browser — basic, no install beyond Prometheus
 *   3. Netdata                                — zero-config, beautiful real-time UI
 *
 * Prometheus scrape config (prometheus.yml):
 *   scrape_configs:
 *     - job_name: "hrms-api"
 *       static_configs:
 *         - targets: ["localhost:3000"]
 *       metrics_path: /metrics
 *       scrape_interval: 15s
 */

// ─── Module-level singleton ───────────────────────────────────────────────────
//
// prom-client's global registry persists across hot reloads — calling
// `new Histogram({ name: "..." })` a second time throws "already registered".
// Keeping the registry + all metrics as module-level singletons means they are
// created exactly ONCE per process lifetime, no matter how many times the
// Fastify plugin initialises.

let registry: Registry | null = null;

type TMetrics = {
  httpRequestDuration: Histogram;
  httpRequestTotal: Counter;
  httpErrorTotal: Counter;
  httpActiveRequests: Gauge;
  dbQueryDuration: Histogram;
  authFailureTotal: Counter;
  circuitBreakerState: Gauge;
};

let metrics: TMetrics | null = null;

const getMetrics = (): { registry: Registry; metrics: TMetrics } => {
  if (!registry) {
    registry = new Registry();
    registry.setDefaultLabels({ app: "sluk-hrms-api" });

    // Collect default Node.js metrics (heap, GC, event loop lag, CPU, handles)
    collectDefaultMetrics({ register: registry, prefix: "nodejs_" });
  }

  if (!metrics) {
    metrics = {
      httpRequestDuration: new Histogram({
        name: "http_request_duration_seconds",
        help: "Duration of HTTP requests in seconds",
        labelNames: ["method", "route", "status_code"],
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
        registers: [registry],
      }),

      httpRequestTotal: new Counter({
        name: "http_requests_total",
        help: "Total number of HTTP requests",
        labelNames: ["method", "route", "status_code"],
        registers: [registry],
      }),

      httpErrorTotal: new Counter({
        name: "http_errors_total",
        help: "Total number of HTTP errors (4xx + 5xx)",
        labelNames: ["method", "route", "status_code", "error_type"],
        registers: [registry],
      }),

      httpActiveRequests: new Gauge({
        name: "http_active_requests",
        help: "Number of HTTP requests currently being processed",
        registers: [registry],
      }),

      dbQueryDuration: new Histogram({
        name: "db_query_duration_seconds",
        help: "Duration of Prisma database queries in seconds",
        labelNames: ["operation", "model"],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        registers: [registry],
      }),

      authFailureTotal: new Counter({
        name: "auth_failures_total",
        help: "Total number of authentication failures",
        labelNames: ["reason"],
        registers: [registry],
      }),

      circuitBreakerState: new Gauge({
        name: "circuit_breaker_open",
        help: "1 if circuit breaker is open (rejecting requests), 0 if closed",
        registers: [registry],
      }),
    };
  }

  return { registry, metrics };
};

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin(async (fastify: FastifyInstance) => {
  const isProd = (fastify as any).IS_PROD ?? false;
  const { registry, metrics } = getMetrics();
  const { authorize } = fastify;

  // ── /metrics endpoint — serve Prometheus text format ──────────────────────
  // We handle this ourselves instead of using fastify-metrics to avoid its
  // own registry/default-metrics setup conflicting with ours
  fastify.get(
    "/metrics",
    { schema: { hide: true }, preHandler: authorize(["admin", "hr_admin"]) },
    async (_req, reply) => {
      const output = await registry.metrics();
      return reply
        .code(200)
        .header("Content-Type", registry.contentType)
        .send(output);
    },
  );

  // ── /metrics/stream – SSE endpoint (NEW) ──────────────────────────────────
  fastify.get(
    "/metrics/stream",
    { schema: { hide: true } },
    async (request, reply) => {
      // 1. Set SSE headers and flush immediately
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*", // allow cross-origin requests
      });
      reply.raw.flushHeaders();

      let isClosed = false;
      const sendMetrics = async () => {
        if (isClosed) return;
        try {
          // Get structured JSON metrics (same as /metrics/summary)
          const jsonMetrics = await registry.getMetricsAsJSON();
          const data = JSON.stringify(jsonMetrics);
          // SSE format: "data: {json}\n\n"
          reply.raw.write(`data: ${data}\n\n`);
          reply.raw.flushHeaders();
        } catch (err) {
          fastify.log.error(err, "SSE metrics stream error");
        }
      };

      // Send initial data immediately
      await sendMetrics();

      // Push updates every second
      const interval = setInterval(sendMetrics, 1000);

      // Clean up on client disconnect
      request.raw.on("close", () => {
        isClosed = true;
        clearInterval(interval);
        fastify.log.info("SSE client disconnected from /metrics/stream");
      });
    },
  );

  // Metric UI
  if (!isProd) {
    const uiHtml = fs.readFileSync(
      path.join(process.cwd(), "views/metrics-ui.html"),
      "utf-8",
    );

    fastify.get(
      "/metrics/ui",
      { schema: { hide: true, preHandler: authorize(["admin", "hr_admin"]) } },
      async (_req, reply) => {
        return reply.code(200).header("Content-Type", "text/html").send(uiHtml);
      },
    );
  }

  // ── Request lifecycle hooks ────────────────────────────────────────────────

  fastify.addHook("onRequest", async (request) => {
    (request as any)._metricStart = process.hrtime.bigint();
    metrics.httpActiveRequests.inc();
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const start = (request as any)._metricStart as bigint | undefined;
    const duration = start
      ? Number(process.hrtime.bigint() - start) / 1_000_000_000
      : 0;

    // routerPath normalises /staff/abc123 → /staff/:id
    // preventing high-cardinality label explosion from dynamic IDs
    const route = (request as any).routerPath ?? request.url ?? "unknown";
    const method = request.method;
    const statusCode = String(reply.statusCode);

    metrics.httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration,
    );
    metrics.httpRequestTotal.inc({ method, route, status_code: statusCode });
    metrics.httpActiveRequests.dec();

    if (reply.statusCode >= 400) {
      metrics.httpErrorTotal.inc({
        method,
        route,
        status_code: statusCode,
        error_type: reply.statusCode >= 500 ? "server_error" : "client_error",
      });
    }
  });

  // ── Decorators for use in routes / other plugins ───────────────────────────

  // Wrap any async DB call to record its duration:
  //   const rows = await fastify.recordDbQuery("findMany", "staff", () => prisma.staff.findMany())
  fastify.decorate(
    "recordDbQuery",
    async <T>(
      operation: string,
      model: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const end = metrics.dbQueryDuration.startTimer({ operation, model });
      try {
        return await fn();
      } finally {
        end();
      }
    },
  );

  fastify.decorate("recordAuthFailure", (reason: string) => {
    metrics.authFailureTotal.inc({ reason });
  });

  // Called from error-handler plugin when circuit breaker state changes
  fastify.decorate("recordCircuitBreaker", (isOpen: boolean) => {
    metrics.circuitBreakerState.set(isOpen ? 1 : 0);
  });

  // ── Health endpoint ────────────────────────────────────────────────────────

  fastify.get(
    "/health",
    { schema: { hide: true }, preHandler: authorize(["admin", "hr_admin"]) },
    async (_req, reply) => {
      const mem = process.memoryUsage();
      const up = process.uptime();
      return reply.code(200).send({
        status: "ok",
        uptime: `${Math.floor(up / 60)}m ${Math.floor(up % 60)}s`,
        memory: {
          heapUsed: `${Math.round(mem.heapUsed / 1_048_576)}MB`,
          heapTotal: `${Math.round(mem.heapTotal / 1_048_576)}MB`,
          rss: `${Math.round(mem.rss / 1_048_576)}MB`,
        },
        circuitBreaker: (fastify as any).circuitBreakerOpen ? "open" : "closed",
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── Dev-only: JSON summary of all metrics ─────────────────────────────────

  if (!isProd) {
    fastify.get(
      "/metrics/summary",
      { schema: { hide: true }, preHandler: authorize(["admin", "hr_admin"]) },
      async (_req, reply) => {
        // registry.getMetricsAsJSON() returns a structured array — easier to read than Prometheus text
        const summary = await registry.getMetricsAsJSON();
        return reply.code(200).send(summary);
      },
    );
  }

  fastify.log.info(
    `metrics: initialized — GET /metrics, GET /health${!isProd ? ", GET /metrics/summary" : ""}`,
  );
});
