import crypto from "node:crypto";
import fastifyPlugin from "fastify-plugin";
import fastifyHelmet from "@fastify/helmet";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * HELMET / CSP PLUGIN
 *
 */
// ─── Nonce helpers ────────────────────────────────────────────────────────────

/** Generate a cryptographically random base64 nonce (128 bits) */
const genNonce = () => crypto.randomBytes(16).toString("base64");

/**
 * Inject the reply nonce into every <script> tag in an HTML string.
 * Call this before reply.send() in any route that serves a UI HTML page.
 *
 * @example
 *   const html = injectNonce(rawHtml, reply.cspNonce);
 *   reply.header("Content-Type", "text/html").send(html);
 */
export function injectNonce(html: string, nonce: string): string {
  // Add nonce to <script> tags that don't already have one
  return html.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
}

// ─── Allowed CDN origins ──────────────────────────────────────────────────────

const CDN_SCRIPTS = [
  "https://cdnjs.cloudflare.com", // Chart.js and other libs used in UI pages
  "https://cdn.jsdelivr.net", // common fallback CDN
] as const;

const CDN_STYLES = [
  "https://fonts.googleapis.com",
  "https://cdnjs.cloudflare.com",
] as const;

const CDN_FONTS = [
  "https://fonts.gstatic.com",
  "https://cdnjs.cloudflare.com",
] as const;

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin(async (fastify) => {
  const isProd =
    (fastify as any).IS_PROD ?? process.env.NODE_ENV === "production";
  const appOrigin = (fastify as any).env?.APP_ORIGIN ?? "http://127.0.0.1:3500";

  // ── 1. Per-request nonce ────────────────────────────────────────────────────
  // Generate a fresh nonce for every request and expose it on the reply
  // so route handlers can embed it in dynamically served HTML.
  fastify.decorateReply("cspNonce", "");

  fastify.addHook(
    "onRequest",
    async (_req: FastifyRequest, reply: FastifyReply) => {
      (reply as any).cspNonce = genNonce();
    },
  );

  // ── 2. Register @fastify/helmet ─────────────────────────────────────────────
  await fastify.register(fastifyHelmet, {
    // Disable helmet's own CSP — we configure it manually below so we can
    // dynamically reference the per-request nonce via the useDefaults approach
    contentSecurityPolicy: false,
  });

  // ── 3. Inject CSP header per-request with the fresh nonce ──────────────────
  // We set the CSP header manually in onSend so we have access to reply.cspNonce
  fastify.addHook(
    "onSend",
    async (req: FastifyRequest, reply: FastifyReply, payload) => {
      const nonce = (reply as any).cspNonce as string;
      const nonceStr = `'nonce-${nonce}'`;

      // API routes don't serve HTML — use a tight CSP
      const isHtmlRoute = (
        (reply.getHeader("content-type") as string) ?? ""
      ).includes("text/html");

      const scriptSrc = isHtmlRoute
        ? [
            "'self'",
            nonceStr, // allows inline <script nonce="..."> blocks
            ...CDN_SCRIPTS, // allows Chart.js and other CDN libs
          ]
        : ["'self'", nonceStr];

      /**
       * scriptSrcAttr controls inline event handlers (onclick=, onerror= etc.)
       * 'none'          — strictest, blocks all inline handlers (best practice)
       * 'unsafe-hashes' — allows pinned hashes reported by the browser
       * 'unsafe-inline' — allows all inline handlers (avoid in prod)
       *
       * ACTION REQUIRED: migrate onclick="fn()" to addEventListener in your HTML
       * then change this to "'none'" for maximum security.
       * While migrating, use 'unsafe-hashes' and pin hashes from browser reports.
       */
      const scriptSrcAttr = ["'none'"]; // relaxed in dev for DX — tighten before prod

      const directives = [
        `default-src 'self'`,
        `script-src ${scriptSrc.join(" ")}`,
        `script-src-elem ${scriptSrc.join(" ")}`,
        `script-src-attr ${scriptSrcAttr.join(" ")}`,
        `style-src 'self' 'unsafe-inline' ${CDN_STYLES.join(" ")}`, // unsafe-inline needed for inline styles in UI pages
        `font-src 'self' ${CDN_FONTS.join(" ")}`,
        `img-src 'self' data: blob:`,
        // connectSrc: covers fetch(), XHR, SSE (EventSource), WebSocket
        `connect-src 'self' ${appOrigin} ${isProd ? "" : "ws://localhost:* wss://localhost:*"}`.trim(),
        `frame-src 'none'`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `upgrade-insecure-requests`,
        // Report violations to a log endpoint for observability
        ...(isProd ? [`report-uri /api/v1/csp-report`] : []),
      ].join("; ");

      reply.header("Content-Security-Policy", directives);

      return payload;
    },
  );

  // ── 4. Additional security headers not covered by the dynamic CSP ──────────
  // @fastify/helmet sets most of these but we override/extend where needed
  fastify.addHook("onSend", async (_req, reply, payload) => {
    // Prevent clickjacking
    reply.header("X-Frame-Options", "DENY");

    // Stop browsers from MIME-sniffing
    reply.header("X-Content-Type-Options", "nosniff");

    // Only send origin on same-origin requests, no referrer cross-site
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Control what browser features the page can access
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
    );

    // HSTS — only in prod (localhost doesn't have a valid cert)
    if (isProd) {
      reply.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }

    // Cross-Origin policies for enhanced isolation
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Cross-Origin-Embedder-Policy", "require-corp");
    reply.header("Cross-Origin-Resource-Policy", "same-site");

    // Remove server fingerprint headers
    reply.removeHeader("X-Powered-By");
    reply.removeHeader("Server");

    return payload;
  });

  // ── 5. CSP violation report endpoint (prod only) ───────────────────────────
  // Browsers POST here when they block something — invaluable for finding
  // violations you haven't accounted for before tightening the policy
  fastify.post(
    "/api/v1/csp-report",
    { schema: { hide: true } },
    async (req, reply) => {
      const report = (req.body as any)?.["csp-report"] ?? req.body;
      fastify.log.warn({ cspReport: report }, "CSP violation reported");
      return reply.code(204).send();
    },
  );

  fastify.log.info(
    `helmet: CSP initialized (mode=${isProd ? "production" : "development"}, nonce=enabled, CDNs=${CDN_SCRIPTS.join(", ")})`,
  );
});
