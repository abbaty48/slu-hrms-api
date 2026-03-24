import type { TPagination } from "./types.ts";

// types/attendance.types.ts
export type TAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "HALF_DAY"
  | "LATE"
  | "ON_LEAVE"
  | "WEEKEND"
  | "HOLIDAY";

// Represent the data's in the database.
export type TAttendance = {
  id: string;
  date: Date;
  staffId: string;
  // rate: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  remarks: string | null;
  workHours: number | null;
  status: TAttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type TAttendanceStats = {
  presentToday: number;
  lateArrivals: number;
  onLeave: number;
  absent: number;
};

export type TMonthlyAttendanceTrend = {
  month: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  attendanceRate: number;
};

export type TAttendanceWeeklyChart = {
  weekData: {
    day: string;
    date: string;
    late: number;
    total: number;
    absent: number;
    onLeave: number;
    halfDay: number;
    present: number;
    attendanceRate: number;
  }[];
  summary: {
    totalOnLeave: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    weekStart: string;
    weekEnd: string;
  };
};

export type TAttendanceResponse = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  checkIn: string | null;
  checkOut?: string | null;
  status: TAttendanceStatus;
  date: string;
  notes?: string;
};

export type TAttendanceResponseList = {
  data: TAttendanceResponse[];
  pagination: TPagination;
};

export type TAttendanceFilters = {
  department?: string;
  status?: TAttendanceStatus | "all";
  date?: string;
  search?: string;
};

// export type TAttendanceSummary = {
//   totalEmployees: number;
//   presentCount: number;
//   absentCount: number;
//   lateCount: number;
//   onLeaveCount: number;
//   attendanceRate: number;
// };

export type TAttendanceSummary = {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  avgWorkHours: string;
};

export type TAttendanceSummaryList = {
  data: {
    summary: TAttendanceSummary;
    attendances: TAttendance[];
  } | null;
  pagination?: TPagination;
};

export type TCheckInRequest = {
  employeeId: string;
  checkInTime: string;
  location?: string;
  notes?: string;
};

export type TCheckOutRequest = {
  employeeId: string;
  checkOutTime: string;
  notes?: string;
};

export type TAttendanceReport = {
  startDate: string;
  endDate: string;
  department?: string;
  data: TAttendanceResponse[];
  summary: TAttendanceSummary;
};
