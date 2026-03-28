import { Type } from "@sinclair/typebox";

export const getRankPaginQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 10, minimum: 1 })),
  q: Type.Optional(Type.String()),
  level: Type.Optional(Type.Number()),
});

export const postRankBodySchema = Type.Object({
  title: Type.String(),
  level: Type.Number(),
  description: Type.String(),
});
