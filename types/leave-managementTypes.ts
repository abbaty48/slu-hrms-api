// types/leave-management.types.ts
import type { TPagination } from "./types";

export type TLeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type TLeaveResponse = {
  id: string;
  staff: {
    name: string;
    staffNo: string;
    department: string;
  }
  startDate: string;
  endDate: string;
  reason: string;
  duration: string;
  status: TLeaveStatus;
  allowedDays: number;
  leaveType: string;
}

export type TLeaveType = {
  id: string;
  name: string;
  allowedDays: number;
  carryForward: boolean;
  maxCarryForward: number;
  paidLeave: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type TLeaveRequest = {
  id: string;
  staffId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number,
  reason: string,
  status: TLeaveStatus,
  approverId: string | null,
  approverComments: string | null,
  appliedAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  fromDate?: Date;
  toDate?: Date;
};


export type TLeaveRequestResponse = {
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
  endDate: string;
  reason?: string;
};

export type TApprovalAction = {
  requestId: string;
  status: "approved" | "rejected";
  comment?: string;
};

export type TLeaveTypeDistribution = {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export type TLeaveApplication = {
  staffId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachment?: string;
}

export type TLeaveApproval = {
  status: TLeaveStatus;
  comments: string;
  approverId: string;
}

export type TLeaveCalendarEntry = {
  date: string;
  staffId: string;
  staffName: string;
  leaveType: string;
  totalDays: number;
  status: TLeaveStatus;
}

export type TLeaveConflict = {
  conflictCount: number;
  staffOnLeave: string[];
  details: {
    staffId: string;
    name: string;
    leaveType: string;
    dates: string;
  }[];
}

export type TLeaveTrend = {
  month: string;
  applications: number;
  approvals: number;
  rejections: number;
  pending: number;
}

export type TLeaveUtilization = {
  department: string;
  departmentId: string;
  totalAllowed: number;
  utilized: number;
  remaining: number;
  utilizationRate: number;
}

export type TLeaveEligibility = {
  eligible: boolean;
  remainingDays: number;
  reason?: string;
  warnings?: string[];
}

export type TLeaveValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: string[];
}

export type TLeaveBalance = {
  leaveTypeId: string;
  remaining: number;
  allowed: number;
  used: number;
  name: string
}

export type TLeavePending = TLeaveResponse & {
  staff: Partial<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  leaveType?: string;
};
