import { Type } from "@sinclair/typebox";

export const getLeaveQueryScheme = Type.Object({
  type: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  toDate: Type.Optional(Type.String({ format: "date" })),
  fromDate: Type.Optional(Type.String({ format: "date" })),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const getLeavePendingQueryScheme = Type.Object({
  departmentId: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const postLeaveBodyScheme = Type.Object({
  staffId: Type.String(),
  reason: Type.String(),
  leaveTypeId: Type.String(),
  startDate: Type.String({ format: "date" }),
  endDate: Type.String({ format: "date" }),
  status: Type.String({ default: "PENDING" }),
});

// patchLeaveApprovalBodyScheme
export const patchLeaveApprovalBodyScheme = Type.Object({
  approverId: Type.Optional(Type.String()),
  approvalComment: Type.Optional(Type.String()),
});

// leaveApprovalParamsScheme
export const leaveApprovalParamsScheme = Type.Object({
  id: Type.String(),
  status: Type.String({ enum: ["APPROVED", "REJECTED"] }),
});

// postLeaveValidateBodyScheme
export const postLeaveValidateBodyScheme = Type.Object({
  staffId: Type.String(),
  leaveTypeId: Type.String(),
  startDate: Type.String({ format: "date" }),
  endDate: Type.String({ format: "date" }),
});

// getLeaveEligibilityQueryScheme
export const getLeaveEligibilityQueryScheme = Type.Object({
  leaveTypeId: Type.String(),
});

// getLeaveConflictsQueryScheme
export const getLeaveConflictsQueryScheme = Type.Object({
  departmentId: Type.String(),
  startDate: Type.String({ format: "date" }),
  endDate: Type.String({ format: "date" }),
});

// getLeaveCalendarQueryScheme
export const getLeaveCalendarQueryScheme = Type.Object({
  month: Type.Number({ minimum: 1, maximum: 12 }),
  year: Type.Number({ minimum: 1900 }),
});

// getLeaveTrendsQueryScheme
export const getLeaveTrendsQueryScheme = Type.Object({
  months: Type.Number({ minimum: 1, maximum: 12 }),
});

//postLeaveTypeBodyScheme
export const postLeaveTypeBodyScheme = Type.Object({
  name: Type.String(),
  allowedDays: Type.Number({ minimum: 0 }),
  paidLeave: Type.Optional(Type.Boolean()),
  carryForward: Type.Optional(Type.Boolean()),
  maxCarryForward: Type.Optional(Type.Number({ minimum: 0 })),
});

//putLeaveTypeBodyScheme
export const putLeaveTypeBodyScheme = Type.Object({
  name: Type.String(),
  paidLeave: Type.Optional(Type.Boolean()),
  allowedDays: Type.Number({ minimum: 0 }),
  carryForward: Type.Optional(Type.Boolean()),
  maxCarryForward: Type.Optional(Type.Number({ minimum: 0 })),
});
