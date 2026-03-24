import { Type } from "@sinclair/typebox";

export const getIdParamScheme = Type.Object({
  id: Type.String(),
});

export const getPaginQueryScheme = Type.Object({
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const getStaffAttendanceSummaryPaginQueryScheme = Type.Object({
  year: Type.Optional(Type.Number()),
  month: Type.Optional(Type.Number()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});
