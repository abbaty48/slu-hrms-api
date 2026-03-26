import { Type } from "@sinclair/typebox";

export const getComitteeQueryScheme = Type.Object({
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 5 })),
  active: Type.Optional(Type.Boolean()),
});
