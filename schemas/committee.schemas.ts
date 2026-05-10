import { Type } from "@sinclair/typebox";

export const getComitteeQueryScheme = Type.Object({
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 5 })),
  actives: Type.Optional(Type.Boolean()),
  term: Type.Optional(Type.String()),
});

export const postComitteeBodyScheme = Type.Object({
  description: Type.Optional(Type.String()),
  abbre: Type.Optional(Type.String()),
  name: Type.String(),
});

export const putComitteeBodyScheme = Type.Object({
  description: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
  abbre: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
});
