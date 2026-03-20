export const loginSchema = {
  body: {
    type: "object",
    required: ["email", "password", "role"],
    properties: {
      role: { type: "string" },
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6 },
    },
    additionalProperties: false,
  },
} as const;
