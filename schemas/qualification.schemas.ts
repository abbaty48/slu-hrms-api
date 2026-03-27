import { Type } from "@sinclair/typebox";

export const getQualificationPaginQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 10, minimum: 1 })),
  year: Type.Optional(Type.String()),
  level: Type.Optional(Type.String()),
  staffId: Type.Optional(Type.String()),
});

export const postQualificationSchema = Type.Object({
  year: Type.String(),
  level: Type.String(),
  degree: Type.String(),
  staffId: Type.String(),
  isHighest: Type.Boolean(),
  institution: Type.String(),
});

export const putQualificationSchema = Type.Object({
  year: Type.Optional(Type.String()),
  level: Type.Optional(Type.String()),
  degree: Type.Optional(Type.String()),
  staffId: Type.Optional(Type.String()),
  isHighest: Type.Optional(Type.Boolean()),
  institution: Type.Optional(Type.String()),
});
