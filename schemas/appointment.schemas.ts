import { Type } from "@sinclair/typebox";

export const getAppointmentQueryScheme = Type.Object({
  active: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const postAppointmentBodyScheme = Type.Object({
  name: Type.String(),
  duraton: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  benefits: Type.Optional(Type.Array(Type.String())),
});

export const putAppointmentBodyScheme = Type.Object({
  name: Type.Optional(Type.String()),
  duraton: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  benefits: Type.Optional(Type.Array(Type.String())),
});
