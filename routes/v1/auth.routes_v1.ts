import fastifyPlugin from "fastify-plugin";
import type { TUser } from "#types/user.type.ts";
import { loginSchema } from "#schemas/auth.schemas.ts";
import type { UserRole } from "../../generated/prisma/enums.ts";

export default fastifyPlugin((fastify) => {
  //  issue access + refresh tokens
  //  1. Validate credentials against DB
  //  2. Call fastify.signAccessToken  → short-lived  (default 1h)
  //  3. Call fastify.signRefreshToken → long-lived   (default 7d)
  //  4. Return access token in JSON body
  //  5. Set refresh token in HttpOnly cookie (never readable by JS)
  fastify.post(
    "/auth/login",
    { schema: loginSchema },
    async (request, reply) => {
      const { email, password, role } = request.body as {
        email: string;
        role: UserRole;
        password: string;
      };

      const user = await fastify.prisma.user.findFirst({ where: { email } });
      if (
        !user ||
        !(await fastify.bcrypt.compare(password, user.passwordHash))
      ) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Invalid credential, or does not exist.",
        });
      }

      if (role !== user.role) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Unauthorized to login with that role.",
        });
      }

      const payload = {
        sub: user.id,
        sId: user.staffId,
        email: user.email,
        role: user.role,
      };

      const accessToken = fastify.signAccessToken(payload);
      const refreshToken = fastify.signRefreshToken(payload);

      // Store refresh token in an HttpOnly, Secure, SameSite=Strict cookie.
      // This prevents XSS from stealing the refresh token entirely.
      reply.setCookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/v1/auth/refresh", // only sent on the refresh endpoint
        maxAge: Number.parseInt(fastify.env.COOKIE_REFRESH_TTL_SEC),
      });

      return reply.code(200).send({
        accessToken,
        user: payload,
        // Expose expiry so the client can schedule a proactive refresh
        expiresIn: process.env.JWT_SIGN_OPTIONS_EXPIRES_IN ?? "1h",
      });
    },
  );

  // ── POST /auth/refresh ─────────────────────────────────────────────────────
  //
  //  Rotate tokens:
  //   1. Extract refresh token from cookie or body
  //   2. Verify it cryptographically + revocation check (verifyToken)
  //   3. Confirm it's actually a refresh-type token
  //   4. Revoke the OLD refresh token (prevents reuse)
  //   5. Issue a fresh access token + fresh refresh token
  //
  //  Clients should call this endpoint when:
  //   a) The access token expires (they get a 401)
  //   b) Proactively, ~1 minute before the access token expires

  fastify.post("/auth/refresh", async (request, reply) => {
    const rawRefreshToken = request.headers.authorization;

    if (!rawRefreshToken) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "No refresh token provided",
      });
    }

    let decoded: any;
    try {
      decoded = await fastify.verifyToken(rawRefreshToken);
    } catch {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Refresh token is invalid or expired — please log in again",
      });
    }

    // Double-check it's actually a refresh token (verifyToken also checks this
    // for authenticate, but refresh tokens are allowed to reach this endpoint)
    if (decoded.type !== "refresh") {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Token is not a refresh token",
      });
    }

    // Revoke the old refresh token immediately (one-time use)
    fastify.revokeToken(
      decoded.jti,
      decoded.exp
        ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
        : 60,
    );

    // Issue fresh pair
    const payload = {
      sub: decoded.sub,
      sId: decoded.staffId,
      role: decoded.role,
      email: decoded.email,
    };

    const newAccessToken = fastify.signAccessToken(payload);
    const newRefreshToken = fastify.signRefreshToken(payload);

    // Rotate the HttpOnly cookie
    reply.setCookie("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: Number.parseInt(fastify.env.COOKIE_REFRESH_TTL_SEC),
    });

    return reply.code(200).send({
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_SIGN_OPTIONS_EXPIRES_IN ?? "1h",
    });
  });
});
