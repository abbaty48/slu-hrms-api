import { Type } from "@sinclair/typebox";

export const getResponsibilityPaginQuerySchema = Type.Object({
  term: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 5 })),
});

export const postResponsibilityBodySchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
});

export const putResponsibilityBodySchema = Type.Object({
  title: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
  description: Type.Optional(Type.String()),
});
