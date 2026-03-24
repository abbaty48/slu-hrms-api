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

export const getStaffPaginQueryScheme = Type.Object({
  q: Type.Optional(Type.String()),
  cadre: Type.Optional(Type.String()),
  state: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  departmentId: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 5 })),
  sort: Type.Optional(Type.String({ default: "asc" })),
});
