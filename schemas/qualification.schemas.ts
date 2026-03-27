import { Type } from "@sinclair/typebox";

export const getIdParamScheme = Type.Object({
  id: Type.String(),
});

export const getQualificationPaginQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 10, minimum: 1 })),
  year: Type.Optional(Type.String()),
  level: Type.Optional(Type.String()),
  staffId: Type.Optional(Type.String()),
});
