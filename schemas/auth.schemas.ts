import type { FastifySchema } from "fastify";

export const loginSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["email", "password", "role"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6 },
      role: { type: "string", enum: ["hr_admin", "dept_admin", "staff"] },
      rememberMe: { type: "boolean", default: false },
    },
    additionalProperties: false,
  },
} as const;

export const changePasswordSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["newPassword", "currentPassword"],
    properties: {
      newPassword: { type: "string", minLength: 6 },
      currentPassword: { type: "string", minLength: 6 },
    },
    additionalProperties: false,
  },
} as const;
