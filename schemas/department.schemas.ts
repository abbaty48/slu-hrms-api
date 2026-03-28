import { Type } from "@sinclair/typebox";

export const getDepartmentPaginQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 10, minimum: 1 })),
  active: Type.Optional(Type.Boolean()),
  q: Type.Optional(Type.String()),
});

export const postDepartmentBodySchema = Type.Object({
  name: Type.String(),
  code: Type.String(),
  headId: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean({ default: true })),
});

export const putDepartmentBodySchema = Type.Object({
  name: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  headId: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
  description: Type.Optional(Type.String()),
});
