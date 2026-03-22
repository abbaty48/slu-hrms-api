/**
 * auth.plugin.ts — Fastify JWT authentication plugin
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALGORITHM CHOICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  HS256 — RECOMMENDED for most applications
 *  • Single shared secret, same key signs AND verifies.
 *  • Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *  • Set in .env: JWT_SECRET=<64-char hex string>
 *
 *  RS256 — for multi-service / OIDC / public key distribution
 *  • Generate: openssl genrsa -out jwtRS256.key 2048
 *              openssl rsa -in jwtRS256.key -pubout -out jwtRS256.key.pub
 *  • Set: JWT_ALGORITHM=RS256, JWT_PRIVATE_KEY_FILE=./jwtRS256.key,
 *         JWT_PUBLIC_KEY_FILE=./jwtRS256.key.pub
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POSTMAN USAGE — READ THIS IF YOU GET FAST_JWT_MALFORMED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ✅ CORRECT:  Authorization tab → Auth Type: "Bearer Token"
 *               Token field: paste the raw JWT returned by signAccessToken
 *               (e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ…)
 *
 *  ❌ WRONG:    Auth Type: "JWT Bearer"
 *               Postman's "JWT Bearer" type generates a BRAND NEW token
 *               using Postman's own secret — it does NOT pass your token.
 *
 *  ❌ WRONG:    Pasting "Bearer eyJ…" (with the prefix) into the Token field.
 *               Postman adds "Bearer " automatically.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ENVIRONMENT VARIABLES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * JWT_ALGORITHM                  Default: "HS256"
 *                                HS256/384/512 | RS256/384/512 | ES256/384/512
 *
 * JWT_SECRET                     Symmetric secret string (≥ 32 bytes). HS* only.
 * JWT_SECRET_FILE                Path to file containing the secret string. HS* only.
 *                                Overrides JWT_SECRET. Used for Docker secrets.
 *
 * JWT_PRIVATE_KEY_FILE           PEM private key path. RS/ES/PS* only. Default: ./jwtRS256.key
 * JWT_PUBLIC_KEY_FILE            PEM public key path.  RS/ES/PS* only. Default: ./jwtRS256.key.pub
 *
 * JWT_SIGN_OPTIONS_EXPIRES_IN    Access token TTL.  Default: "1h"
 * JWT_REFRESH_EXPIRES_IN         Refresh token TTL. Default: "7d"
 *
 * USE_REDIS_FOR_JWT              "true" to use Redis. Default: "false"
 * REDIS_URL                      Default: "redis://127.0.0.1:6379"
 */

import IORedis from "ioredis";
import jwt from "@fastify/jwt";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fastifyPlugin from "fastify-plugin";
import type { FastifyReply, FastifyRequest, FastifyPluginAsync } from "fastify";
import type { TAuthUser } from "#types/authTypes.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TokenStorage {
  get(k: string): Promise<unknown>;
  set(k: string, v: unknown, ttlSec: number): Promise<void>;
  del(k: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module augmentation — required for TypeScript to resolve FastifyInstance
// correctly (prevents `fastify` parameter collapsing to `never`)
// ─────────────────────────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    signAccessToken(payload?: Record<string, unknown>): string;
    signRefreshToken(payload?: Record<string, unknown>): string;
    revokeToken(jti: string, ttlSec?: number): void;
    /**
     * Verify a JWT string. Accepts:
     *   - raw token:          "eyJhbGci…"
     *   - with Bearer prefix: "Bearer eyJhbGci…"  (prefix is stripped automatically)
     */
    verifyToken(token: string): Promise<TAuthUser>;
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    authorize(
      allowedRoles: string[],
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermissions(
      permissions: string[],
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    revokeCurrentToken(request: FastifyRequest): Promise<void>;
    // Optional cache decorators from a separate cache plugin
    cacheGet?: (key: string) => Promise<unknown>;
    cacheSet?: (key: string, value: unknown, ttlSec: number) => Promise<void>;
    cacheDel?: (key: string) => Promise<void>;
  }

  interface FastifyRequest {
    // user: TUser;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm helpers
// ─────────────────────────────────────────────────────────────────────────────

type AlgorithmFamily = "HS" | "RS" | "ES" | "PS";

function normaliseAlgorithm(raw: string): string {
  return raw.replace(/^RSA/i, "RS").replace(/^ESA/i, "ES").toUpperCase();
}

function algorithmFamily(alg: string): AlgorithmFamily {
  const prefix = alg.slice(0, 2) as AlgorithmFamily;
  if (!["HS", "RS", "ES", "PS"].includes(prefix)) {
    throw new Error(
      `Unsupported JWT algorithm "${alg}". Valid: HS256, RS256, ES256, etc.`,
    );
  }
  return prefix;
}

function assertPem(content: string, label: string): void {
  if (!content.includes("-----BEGIN ")) {
    throw new Error(
      `jwt: ${label} is not a valid PEM file (missing "-----BEGIN …" header). ` +
        `Check your key file path and contents.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token string sanitizer
//
// This is the PRIMARY fix for FAST_JWT_MALFORMED.
//
// fast-jwt throws "The token header is not a valid base64url serialized JSON"
// whenever the string passed to verify() is not a bare JWT. Common causes:
//
//   1. "Bearer eyJ…"   — the caller forgot to strip the scheme prefix
//   2. `"eyJ…"`        — token wrapped in quotes (copy/paste from JSON)
//   3. "eyJ…\n"        — trailing newline from file read or echo
//   4. undefined/null  — token missing entirely
//
// Sanitizing here (inside verifyToken) means the error is caught regardless
// of how verifyToken is called — from authenticate(), from a route handler
// that reads request.body, or from a test.
// ─────────────────────────────────────────────────────────────────────────────

const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*$/;

function sanitizeToken(raw: unknown): string {
  if (typeof raw !== "string" || !raw) {
    throw Object.assign(new Error("jwt: token is missing or not a string"), {
      statusCode: 401,
      code: "JWT_MISSING",
    });
  }

  // Strip surrounding whitespace and quotes
  let token = raw.trim().replace(/^["']|["']$/g, "");

  // Strip "Bearer " or "bearer " prefix — guard against callers who pass the
  // full Authorization header value instead of the extracted token
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, "");
  }

  // Final trim in case there was whitespace after "Bearer "
  token = token.trim();

  // Validate JWT structure: three base64url segments separated by dots
  if (!JWT_SHAPE.test(token)) {
    throw Object.assign(
      new Error(
        `jwt: token has an invalid format. ` +
          `Expected a JWT with three base64url segments (header.payload.signature). ` +
          `If using Postman, use Auth Type "Bearer Token" and paste ONLY the raw token ` +
          `(e.g. eyJhbGci…) — do NOT use "JWT Bearer" (that generates Postman's own token).`,
      ),
      { statusCode: 401, code: "JWT_MALFORMED" },
    );
  }

  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────────────────────

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const {
    JWT_SECRET,
    JWT_SECRET_FILE,
    JWT_REFRESH_EXPIRES_IN = "7d",
    JWT_SIGN_OPTIONS_EXPIRES_IN = "1h",
    JWT_PRIVATE_KEY_FILE = "./jwtRS256.key",
    JWT_PUBLIC_KEY_FILE = "./jwtRS256.key.pub",
    JWT_ALGORITHM: JWT_ALGORITHM_RAW = "HS256",
    REDIS_URL = "redis://127.0.0.1:6379",
    USE_REDIS_FOR_JWT = "false",
  } = process.env;

  const JWT_ALGORITHM = normaliseAlgorithm(JWT_ALGORITHM_RAW);
  const family = algorithmFamily(JWT_ALGORITHM);

  // ── Build secret / key-pair ─────────────────────────────────────────────────

  let jwtSecret: string | { private: string; public: string };

  if (family === "HS") {
    let symmetricSecret = JWT_SECRET;

    if (JWT_SECRET_FILE) {
      try {
        symmetricSecret = (await fs.readFile(JWT_SECRET_FILE, "utf8")).trim();
        fastify.log.info(
          `jwt: loaded symmetric secret from "${JWT_SECRET_FILE}"`,
        );
      } catch (err: any) {
        fastify.log.error(
          `jwt: cannot read JWT_SECRET_FILE="${JWT_SECRET_FILE}": ${err.message}`,
        );
        throw err;
      }
    }

    if (!symmetricSecret || Buffer.from(symmetricSecret).length < 32) {
      throw new Error(
        `JWT: ${JWT_ALGORITHM} requires a symmetric secret of at least 32 bytes.\n` +
          `  Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n` +
          `  Then:     JWT_SECRET=<64-char-hex>  in your .env file`,
      );
    }

    jwtSecret = symmetricSecret;
    fastify.log.info(`jwt: symmetric secret loaded for ${JWT_ALGORITHM}`);
  } else {
    try {
      const [rawPrivate, rawPublic] = await Promise.all([
        fs.readFile(JWT_PRIVATE_KEY_FILE, "utf8"),
        fs.readFile(JWT_PUBLIC_KEY_FILE, "utf8"),
      ]);
      const privateKey = rawPrivate.trim();
      const publicKey = rawPublic.trim();
      assertPem(privateKey, `JWT_PRIVATE_KEY_FILE ("${JWT_PRIVATE_KEY_FILE}")`);
      assertPem(publicKey, `JWT_PUBLIC_KEY_FILE  ("${JWT_PUBLIC_KEY_FILE}")`);
      jwtSecret = { private: privateKey, public: publicKey };
      fastify.log.info(
        `jwt: asymmetric key pair loaded for ${JWT_ALGORITHM} ` +
          `(private="${JWT_PRIVATE_KEY_FILE}", public="${JWT_PUBLIC_KEY_FILE}")`,
      );
    } catch (err: any) {
      fastify.log.error(`jwt: cannot load PEM key files: ${err.message}`);
      throw err;
    }
  }

  // ── Register @fastify/jwt ──────────────────────────────────────────────────
  //
  // Do NOT await fastify.register() — use fastify.after() instead.
  // Awaiting register() causes AVV_ERR_PLUGIN_EXEC_TIMEOUT in Fastify 4 & 5.

  fastify.register(jwt, {
    secret: jwtSecret,
    sign: {
      algorithm: JWT_ALGORITHM as any,
      expiresIn: JWT_SIGN_OPTIONS_EXPIRES_IN,
    },
    verify: {
      algorithms: [JWT_ALGORITHM as any],
    },
  });

  await fastify.after();

  // ── Token storage ──────────────────────────────────────────────────────────

  let storage: TokenStorage;

  if (
    typeof fastify.cacheGet === "function" &&
    typeof fastify.cacheSet === "function" &&
    typeof fastify.cacheDel === "function"
  ) {
    storage = {
      get: (k) => fastify.cacheGet!(k),
      set: (k, v, ttlSec) => fastify.cacheSet!(k, v, ttlSec),
      del: (k) => fastify.cacheDel!(k),
    };
    fastify.log.info("jwt: using fastify.cache* for token store");
  } else if (String(USE_REDIS_FOR_JWT).toLowerCase() === "true") {
    try {
      const r = new IORedis.Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      await r.ping();
      storage = {
        get: async (k) => {
          const v = await r.get(k);
          return v ? (JSON.parse(v) as unknown) : null;
        },
        set: async (k, v, ttlSec) => {
          await r.set(
            k,
            JSON.stringify(v),
            "EX",
            Math.max(1, Math.floor(ttlSec)),
          );
        },
        del: async (k) => {
          await r.del(k);
        },
      };
      fastify.addHook("onClose", async () => {
        try {
          await r.quit();
        } catch (_) {}
      });
      fastify.log.info("jwt: connected to Redis for token store");
    } catch (err: any) {
      fastify.log.warn(
        `jwt: Redis unavailable (${err?.message}), using in-memory Map`,
      );
      storage = makeInMemoryStorage();
    }
  } else {
    storage = makeInMemoryStorage();
    fastify.log.info(
      "jwt: using in-memory Map for token store (non-persistent)",
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const makeAllowKey = (jti: string) => `jwt:refresh:allow:${jti}`;
  const makeBlacklistKey = (jti: string) => `jwt:blacklist:${jti}`;

  function remainingTtl(decoded: any, fallbackSec = 3600): number {
    if (!decoded?.exp) return fallbackSec;
    return Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));
  }

  async function isRevokedOrNotAllowed(decoded: any): Promise<boolean> {
    if (!decoded) return true;
    if (!decoded.jti) {
      fastify.log.warn("jwt: token missing jti claim — rejected");
      return true;
    }
    if (await storage.get(makeBlacklistKey(decoded.jti))) return true;
    if (decoded.type === "refresh") {
      const allowed = await storage.get(makeAllowKey(decoded.jti));
      if (!allowed) return true;
    }
    return false;
  }

  // ── Decorators ─────────────────────────────────────────────────────────────

  // USE CASE: to sign-up a user
  fastify.decorate(
    "signAccessToken",
    function signAccessToken(payload: Record<string, unknown> = {}): string {
      const jti = crypto.randomUUID();
      return fastify.jwt.sign({ ...payload, jti, type: "access" }, {
        expiresIn: JWT_SIGN_OPTIONS_EXPIRES_IN,
      } as any);
    },
  );

  // USE CASE: keep user authenticated
  fastify.decorate(
    "signRefreshToken",
    function signRefreshToken(payload: Record<string, unknown> = {}): string {
      const jti = crypto.randomUUID();
      const token = fastify.jwt.sign({ ...payload, jti, type: "refresh" }, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
      } as any);
      const decoded = fastify.jwt.decode(token) as any;
      const ttl = remainingTtl(decoded, 60 * 60 * 24 * 7);
      storage
        .set(makeAllowKey(jti), true, ttl)
        .catch((e) =>
          fastify.log.error("jwt: failed to write refresh allowlist entry", e),
        );
      return token;
    },
  );

  // USE CASE: to sign-out/reject a user
  fastify.decorate(
    "revokeToken",
    function revokeToken(jti: string, ttlSec = 60): void {
      if (!jti) return;
      const ttl = Math.max(1, Math.floor(ttlSec));
      storage
        .set(makeBlacklistKey(jti), true, ttl)
        .catch((e) => fastify.log.error("jwt: failed to blacklist token", e));
      storage.del(makeAllowKey(jti)).catch(() => {});
    },
  );

  // USE CASE: authenticate/sign-in a user
  fastify.decorate(
    "verifyToken",
    async function verifyToken(rawToken: string): Promise<TAuthUser> {
      // Step 1 — sanitize: strip Bearer prefix, trim whitespace/quotes,
      // and validate the JWT three-part shape BEFORE handing to fast-jwt.
      // This is the fix for FAST_JWT_MALFORMED — fast-jwt throws that error
      // whenever the string isn't a bare base64url-encoded JWT.
      const token = sanitizeToken(rawToken);

      // Step 2 — cryptographic verification.
      // No call-time options are passed: the algorithm and key are already
      // locked via the `verify: { algorithms: [...] }` option at registration.
      // Passing options here creates an ad-hoc verifier with NO key material
      // (only the algorithm), which also causes FAST_JWT_MALFORMED for RS/ES.
      //
      // NOTE: In @fastify/jwt v9+ (Fastify 5) fastify.jwt.verify() returns a
      // Promise and must be awaited. We await unconditionally — if the version
      // returns synchronously, await on a non-Promise is a no-op.
      let decoded: TAuthUser;
      try {
        decoded = await (fastify.jwt.verify(token) as Promise<TAuthUser>);
      } catch (err: any) {
        fastify.log.debug(`jwt: verify failed — ${err?.message}`);
        // Re-throw with a consistent 401 status so callers don't need to inspect
        throw Object.assign(err, { statusCode: err.statusCode ?? 401 });
      }

      // Step 3 — revocation check
      if (await isRevokedOrNotAllowed(decoded)) {
        throw Object.assign(new Error("token_revoked_or_not_allowed"), {
          statusCode: 401,
          code: "JWT_REVOKED",
        });
      }

      return decoded;
    },
  );

  // USE CASE: signup/grand a user
  fastify.decorate(
    "authenticate",
    async function authenticate(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      // Extract the raw Authorization header value — verifyToken will handle
      // stripping "Bearer " so we don't need to do it here too
      const raw = request.headers.authorization ?? "";

      if (!raw) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Missing Authorization header",
        });
      }

      let decoded: TAuthUser;
      try {
        decoded = await fastify.verifyToken(raw);
      } catch (err: any) {
        fastify.log.debug(`jwt: authenticate failed — ${err?.message}`);
        return reply
          .code(401)
          .send({ error: "Unauthorized", message: "Invalid or revoked token" });
      }

      if ((decoded as any).type === "refresh") {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Refresh tokens cannot be used for API authentication",
        });
      }

      request.user = decoded;
    },
  );

  // USE CASE: determine who should've access to an endpoint
  fastify.decorate("authorize", function authorize(allowedRoles: string[]) {
    return async function (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;
      const role = request.user?.role;
      if (!role || !allowedRoles.includes(role)) {
        return reply.code(403).send({
          error: "Forbidden",
          message: `Requires one of roles: ${allowedRoles.join(", ")}`,
        });
      }
    };
  });

  // USE CASE: to sign out user
  fastify.decorate(
    "revokeCurrentToken",
    async function revokeCurrentToken(request: FastifyRequest): Promise<void> {
      const raw = request.headers.authorization ?? "";
      if (!raw) return;
      try {
        const token = sanitizeToken(raw); // strips Bearer prefix
        const decoded = fastify.jwt.decode(token) as any;
        if (!decoded?.jti) return;
        const ttl = remainingTtl(decoded, 60);
        await storage.set(makeBlacklistKey(decoded.jti), true, ttl);
        await storage.del(makeAllowKey(decoded.jti));
      } catch (_) {
        // Best-effort — a logout should never fail the response
      }
    },
  );

  fastify.log.info(
    `jwt: ready — alg=${JWT_ALGORITHM} access=${JWT_SIGN_OPTIONS_EXPIRES_IN} refresh=${JWT_REFRESH_EXPIRES_IN}`,
  );
};

export default fastifyPlugin(authPlugin, {
  name: "auth-plugin",
  fastify: "5.x",
});

// ─────────────────────────────────────────────────────────────────────────────
// In-memory token storage
// ─────────────────────────────────────────────────────────────────────────────

function makeInMemoryStorage(): TokenStorage {
  const store = new Map<string, unknown>();
  return {
    async get(k) {
      return store.get(k) ?? null;
    },
    async set(k, v, ttlSec) {
      store.set(k, v);
      if (ttlSec > 0) {
        setTimeout(() => store.delete(k), ttlSec * 1_000).unref?.();
      }
    },
    async del(k) {
      store.delete(k);
    },
  };
}
