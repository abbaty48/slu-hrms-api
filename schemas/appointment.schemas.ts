import { Type } from "@sinclair/typebox";

export const getAppointmentQueryScheme = Type.Object({
  active: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});
