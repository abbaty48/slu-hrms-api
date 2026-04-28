// types/leave-management.types.ts
import type { __pagination } from "#utils/utils_helper.ts";
import type { TStaff } from "./staffTypes.ts";
import type { TPagination } from "./types.ts";

export type TLeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type TLeave = {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
  status: TLeaveStatus;
  staffId: string;
  leaveTypeId: string;
  totalDays: number;
  approver: {
    id: string,
    rank: string,
    name: string,
  } | null;
  approverComments: string | null;
  appliedAt: Date;
  respondedAt: Date | null;
  studyLeaveDetails: TLeaveStudyDetails | null;
  updatedAt: Date;
  createdAt: Date;
};

export type TLeaveStudyDetails = {
  institution: string;
  programme: string;
  degreeType: "PHD" | "MSC" | "PGD" | "BSC";
  studyMode: "FULL_TIME" | "PART_TIME";
  durationYear: number;
  country: string | null;
  sponsorshipType:
    | "Self"
    | "StateGovernment"
    | "UniversityBase"
    | "TedFund"
    | "Others";
  leaveCategory: "Study" | "Medical" | "Maternity" | "Paternity" | "Other";
  payStatus: "WithPayment" | "WithoutPayment" | null;
  guarantor_NextOfKin: string | null;
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
  studyLeaveDetails: TLeaveStudyDetails | null;
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
  leaves: TLeave[];
  search: string;
  status: string;
  type: string;
  limit: string;
  fromDate: Date | null;
  toDate: Date | null;
};

export type TStaffSnippet = {
  id: string;
  name: string;
  staffNo: string;
  department: string | null;
};

export type TLeaveItem = Omit<TLeave, "staff"> & {
  staff: TStaffSnippet | null;
};

export type TLeaveList = {
  data: TLeaveItem[];
  pagination: ReturnType<typeof __pagination> | null;
};

export type TLeaveTypeList = TLeaveType[];

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

export type TChartLeaveTypeDistribution = {
  name: string;
  value: number;
  percentage: number;
  color: string | undefined;
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

export type TChartLeaveUtilization = {
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

export type TLeavePending = TLeave & {
  staff: Partial<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  leaveType?: string;
};

export type TChartAttendanceCurrentWeek = {
  weekData: {
    date: string;
    day: string;
    present: number;
    late: number;
    absent: number;
    onLeave: number;
    halfDay: number;
    total: number;
    attendanceRate: number;
  }[];
  weekSummary: {
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalOnLeave: number;
    avgAttendanceRate: number;
    weekStart: string | undefined;
    weekEnd: string | undefined;
  };
};
