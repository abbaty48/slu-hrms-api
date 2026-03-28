import { Type } from "@sinclair/typebox";

export const getResponsibilityPaginQuerySchema = Type.Object({
  active: Type.Optional(Type.Boolean()),
  department: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 10 })),
});

const Priority = Type.Union([
  Type.Literal("low"),
  Type.Literal("high"),
  Type.Literal("medium"),
]);

export const postResponsibilityBodySchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  prority: Type.Optional(Priority),
  assignedTo: Type.Array(Type.String()),
  department: Type.Optional(Type.String()),
});
