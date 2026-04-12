import { Type } from "@sinclair/typebox";
import type { FastifySchema } from "fastify";

const pattern =
  "^(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+={}\\[\\]|\\\\:;\"'<>,.?/~`]).{8,}$";

export const postAuthenticateSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({
    pattern,
    format: "regex",
    description: "A minimum of 8 password length required.",
  }),
});

export const postAuthSchema = Type.Object({
  email: Type.String({ format: "email" }),
  staffId: Type.String(),
  role: Type.Union([
    Type.Literal("staff"),
    Type.Literal("hr_admin"),
    Type.Literal("dept_admin"),
  ]),
  password: Type.String({
    pattern,
    format: "regex",
    description: "A minimum of 8 password length required.",
  }),
});

export const postChangePasswordSchema = Type.Object({
  currentPassword: Type.String({
    pattern,
    format: "regex",
    description: "A minimum of 8 password length required.",
  }),
  newPassword: Type.String({
    pattern,
    format: "regex",
    description: "A minimum of 8 password length required.",
  }),
});
