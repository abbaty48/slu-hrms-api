import { Type } from "@sinclair/typebox";

export const getResponsibilityPaginQuerySchema = Type.Object({
  active: Type.Optional(Type.Boolean()),
  department: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 10 })),
});
