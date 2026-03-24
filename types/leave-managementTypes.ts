// types/leave-management.types.ts
import type { TPagination } from "./types.ts";

export type TLeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type TLeaveResponse = {
  id: string;
  staff: {
    name: string;
    staffNo: string;
    department: string;
  };
  startDate: Date;
  endDate: Date;
  reason: string | null;
  duration: string;
  status: TLeaveStatus;
  allowedDays: number;
  leaveType: string;
};

export type TLeaveType = {
  id: string;
  name: string;
  allowedDays: number;
  carryForward: boolean;
  maxCarryForward: number;
  paidLeave: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TLeaveRequest = {
  id: string;
  staffId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string | null;
  status: TLeaveStatus;
  approverId: string | null;
  approverComments: string | null;
  appliedAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TLeaveStats = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
};

export type TLeaveFilters = {
  leaves: TLeaveResponse[];
  search: string;
  status: string;
  type: string;
  limit: string;
  fromDate: Date | null;
  toDate: Date | null;
};

export type TLeaveList = {
  data: TLeaveRequest[];
  pagination: TPagination;
};

export type TLeaveTypeFormData = {
  name: string;
  days: number;
  description?: string;
};

export type TLeaveRequestFormData = {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: Date;
  reason: string | null;
};

export type TApprovalAction = {
  requestId: string;
  status: "approved" | "rejected";
  comment?: string;
};

export type TLeaveTypeDistribution = {
  name: string;
  value: number;
  color: string;
  percentage: number;
};

export type TLeaveApplication = {
  staffId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
  attachment: string | null;
};

export type TLeaveApproval = {
  status: TLeaveStatus;
  comments: string;
  approverId: string;
};

export type TLeaveCalendarEntry = {
  date: Date;
  staffId: string;
  staffName: string;
  leaveType: string;
  totalDays: number;
  status: TLeaveStatus;
};

export type TLeaveConflict = {
  conflictCount: number;
  staffOnLeave: string[];
  details: {
    staffId: string;
    name: string;
    leaveType: string;
    dates: Date;
  }[];
};

export type TLeaveTrend = {
  month: string;
  applications: number;
  approvals: number;
  rejections: number;
  pending: number;
};

export type TLeaveUtilization = {
  department: string;
  departmentId: string;
  totalAllowed: number;
  utilized: number;
  remaining: number;
  utilizationRate: number;
};

export type TLeaveEligibility = {
  eligible: boolean;
  remainingDays: number;
  reason: string | null;
  warnings: string[] | null;
};

export type TLeaveValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: string[];
};

export type TLeaveBalance = {
  leaveTypeId: string;
  remaining: number;
  allowed: number;
  used: number;
  name: string;
};

export type TLeaveBalanceList = {
  data: TLeaveBalance[];
  pagination: TPagination;
};

export type TLeavePending = TLeaveResponse & {
  staff: Partial<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  leaveType?: string;
};
