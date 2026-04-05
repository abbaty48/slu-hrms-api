import { Type } from "@sinclair/typebox";

export const getLeaveTypeDistributionChartQueryScheme = Type.Object({
  year: Type.Optional(Type.Number({ minimum: 1990 })),
});

export const getStaffPerDepartmentChartQueryScheme = Type.Object({
  limit: Type.Optional(Type.Number({ default: 10 })),
});
