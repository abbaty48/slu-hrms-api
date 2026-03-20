import fastifyPlugin from "fastify-plugin";
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
});
