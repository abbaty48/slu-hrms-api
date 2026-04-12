import type {
  TAuthUser,
  IAuthResponse,
  IAuthRefreshResponse,
} from "#types/authTypes.ts";
import {
  postAuthSchema,
  postAuthenticateSchema,
  postChangePasswordSchema,
} from "#schemas/auth.schemas.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import type { TResponseType } from "#types/responseType.ts";
import { __reply, errReply, idGenerator } from "#utils/utils_helper.ts";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;
  //  issue access + refresh tokens
  //  1. Validate credentials against DB
  //  2. Call fastify.signAccessToken  → short-lived  (default 1h)
  //  3. Call fastify.signRefreshToken → long-lived   (default 7d)
  //  4. Return access token in JSON body
  //  5. Set refresh token in HttpOnly cookie (never readable by JS)
  fastify.post<{
    Body: Static<typeof postAuthenticateSchema>;
  }>(
    "/auth/login",
    { schema: postAuthenticateSchema },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await fastify.prisma.user.findFirst({ where: { email } });
      if (
        !user ||
        !(await fastify.bcrypt.compare(password, user.passwordHash))
      ) {
        return errReply(
          reply,
          401,
          "Unauthorized",
          "Invalid credential, or does not exist.",
        );
      }

      const payload: TAuthUser = {
        sub: user.id,
        email: user.email,
        role: user.role as string,
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

      await prisma.user.update({
        data: { lastLogin: new Date().toISOString() },
        where: { id: user.id },
      });

      return __reply<IAuthResponse>(reply, 200, {
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
      return errReply(reply, 401, "Unauthorized", "No refresh token provided");
    }

    let decoded: any;
    try {
      decoded = await fastify.verifyToken(rawRefreshToken);
    } catch {
      return errReply(
        reply,
        401,
        "Unauthorized",
        "Refresh token is invalid or expired — please log in again",
      );
    }

    // Double-check it's actually a refresh token (verifyToken also checks this
    // for authenticate, but refresh tokens are allowed to reach this endpoint)
    if (decoded.type !== "refresh") {
      return errReply(
        reply,
        401,
        "Unauthorized",
        "Token is not a refresh token",
      );
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
      role: decoded.role,
      email: decoded.email,
    };

    const newAccessToken = fastify.signAccessToken(payload);
    const newRefreshToken = fastify.signRefreshToken(payload);

    // Rotate the HttpOnly cookie
    reply.setCookie("refresh_token", newRefreshToken, {
      httpOnly: true,
      sameSite: "strict",
      path: "/api/v1/auth/refresh",
      secure: process.env.NODE_ENV === "production",
      maxAge: Number.parseInt(fastify.env.COOKIE_REFRESH_TTL_SEC),
    });

    return __reply<IAuthRefreshResponse>(reply, 200, {
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_SIGN_OPTIONS_EXPIRES_IN ?? "1h",
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────
  //
  //  Blacklists the current access token so it can't be reused
  //  even before it expires.
  fastify.post(
    "/auth/logout",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      await fastify.revokeCurrentToken(request);

      // Also clear the refresh cookie
      reply.clearCookie("refresh_token", { path: "/api/v1/auth/refresh" });

      return __reply(reply, 200, { message: "Logged out successfully" });
    },
  );

  // ── POST /auth/logout-all ──────────────────────────────────────────────────
  //
  //  Full sign-out: revoke access token + whatever refresh token is present.
  //  Use this for "sign out of all devices" or a security incident response.
  fastify.post(
    "/auth/logout-all",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      // Revoke access token
      await fastify.revokeCurrentToken(request);

      // Revoke refresh token if present
      const rawRefreshToken = request.headers.authorization;
      if (rawRefreshToken) {
        try {
          const decoded: any = await fastify.verifyToken(rawRefreshToken);
          fastify.revokeToken(
            decoded.jti,
            decoded.exp
              ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
              : Number.parseInt(fastify.env.COOKIE_REFRESH_TTL_SEC),
          );
        } catch {
          // Refresh token already invalid — that's fine
        }
      }

      reply.clearCookie("refresh_token", { path: "/api/v1/auth/refresh" });

      return __reply(reply, 200, {
        message: "All sessions revoked. You have been signed out everywhere.",
      });
    },
  );

  // ── GET /auth/me ───────────────────────────────────────────────────────────
  //
  //  Any authenticated user can fetch their own profile.
  //  The decoded JWT payload is attached to request.user by authenticate.

  fastify.get(
    "/auth/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.sub },
        omit: { passwordHash: true },
      });
      return reply.code(200).send(user);
    },
  );

  // ── PUT /auth/me/password ──────────────────────────────────────────────────

  fastify.put<{
    Body: Static<typeof postChangePasswordSchema>;
  }>(
    "/auth/me/password",
    {
      preHandler: fastify.authenticate,
      schema: postChangePasswordSchema,
    },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body;
      const userId = (request.user as TAuthUser).sub;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return errReply(
          reply,
          400,
          "Bad Request",
          "User not found with that identity.",
        );
      }

      if (!(await fastify.bcrypt.compare(currentPassword, user.passwordHash))) {
        return errReply(
          reply,
          400,
          "Bad Request",
          "Current password is incorrect",
        );
      }

      // update the user password
      await fastify.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await fastify.bcrypt.hash(newPassword) },
      });

      // Security: revoke all existing tokens after a password change
      await fastify.revokeCurrentToken(request);
      reply.clearCookie("refresh_token", { path: "/api/v1/auth/refresh" });

      return __reply(reply, 200, {
        message:
          "Password updated. Please log in again with your new password.",
      });
    },
  );

  // ── POST /auth ──────────────────────────────────────────────────

  fastify.post<{
    Body: Static<typeof postAuthSchema>;
  }>(
    "/auth",
    {
      schema: { body: postAuthSchema },
      preHandler: authorize(["hr_admin", "dept_admin"]),
    },
    async (request, reply) => {
      const { email, staffId, role, password } = request.body;

      try {
        /**
         *
         *
         */
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          return errReply(
            reply,
            400,
            "Action aborted.",
            "Cannot proceed the action, the user is already taken with that email.",
          );
        }
        /**
         *
         *
         */
        const staff = await prisma.staff.findUnique({ where: { id: staffId } });

        if (!staff || staff.email !== email) {
          return errReply(
            reply,
            401,
            "Action aborted.",
            "No staff, or staff associated with that email.",
          );
        }
        /**
         *
         */
        const newUser = await prisma.user.create({
          data: {
            id: idGenerator("usr_"),
            role,
            email,
            staffId: staff.id,
            lastName: staff.lastName,
            firstName: staff.firstName,
            passwordHash: await fastify.bcrypt.hash(password),
          },
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: "User account is created.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to register identify. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  fastify.log.info("Api: Authenticate endpoints routes loaded.");
});
