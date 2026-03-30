import { Type } from "@sinclair/typebox";

export const postAttendanceMarkBodyScheme = Type.Object({
  status: Type.String(),
  staffId: Type.String(),
  date: Type.String({ format: "date" }),
  remarks: Type.Optional(Type.String()),
  checkIn: Type.Optional(Type.String({ format: "date" })),
  checkOut: Type.Optional(Type.String({ format: "date" })),
});

export const postAttendanceBulkMarkBodyScheme = Type.Array(
  postAttendanceMarkBodyScheme,
);

export const putAttendanceBodySchema = Type.Partial(
  postAttendanceMarkBodyScheme,
);

export const getAttendanceQueryScheme = Type.Object({
  status: Type.Optional(Type.String()),
  staffId: Type.Optional(Type.String()),
  departmentId: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 10 })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  startDate: Type.Optional(Type.String({ format: "date" })),
});

export const getAttendanceReportQueryScheme = Type.Object({
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  departmentId: Type.Optional(Type.String()),
});

export const getAttendanceStaffQueryScheme = Type.Object({
  year: Type.Optional(Type.Number()),
  month: Type.Optional(Type.Number()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 10 })),
});

export const getAttendanceDeptStatsQueryScheme = Type.Object({
  endDate: Type.Optional(Type.String({ format: "date" })),
  startDate: Type.Optional(Type.String({ format: "date" })),
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
