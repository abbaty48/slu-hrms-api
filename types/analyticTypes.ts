// ========================================
// ANALYTICS & REPORTS TYPES
// ========================================

// Analytics Data Types
export interface StaffStrengthYearData {
  year: string;
  Male: number;
  Female: number;
  total: number;
}

export interface StaffCategoryData {
  // name: "Academic" | "Non-Academic" | "Admin";
  name: string;
  value: number;
  fill: string;
}

export interface StaffDepartmentData {
  department: string;
  staffCount: number;
}

export interface MonthlyLeaveData {
  month: string;
  "Leave Days Used": number;
}

export interface PayrollBreakdownData {
  month: string;
  Salary: number; // In millions
  Allowances: number;
  Deductions: number;
}

// Summary Types
export interface AnalyticsSummary {
  staff: {
    total: number;
    male: number;
    female: number;
    teaching: number;
    nonTeaching: number;
    admin: number;
  };
  leave: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    totalDays: number;
  };
  payroll: {
    annualSalary: number; // In millions
    annualAllowances: number;
    annualDeductions: number;
    netPayroll: number;
  };
  year: number;
}

export interface DepartmentPerformance {
  department: string;
  staffCount: number;
  male: number;
  female: number;
  teaching: number;
  nonTeaching: number;
  totalLeaves: number;
  approvedLeaves: number;
  leaveApprovalRate: number; // Percentage
}

export interface YearOverYearGrowth {
  year: string;
  totalStaff: number;
  growthRate: number; // Percentage
  growth: number; // Absolute number
}

export interface LeaveTypeDistribution {
  type: string;
  count: number;
  percentage: number;
}

// Filter Types
export interface AnalyticsFilters {
  departmentId?: string;
  year?: number;
  startYear?: number;
  endYear?: number;
  startDate?: string;
  endDate?: string;
  months?: number;
  limit?: number;
}

// Export Types
export interface ExportReportData {
  generatedAt: string;
  totalRecords: number;
  filters: {
    departmentId?: string;
    startDate?: string;
    endDate?: string;
  };
  data: Array<{
    staffNo: string;
    name: string;
    email: string;
    gender: string;
    department: string;
    rank: string;
    cadre: string;
    category: string;
    status: string;
    joinDate: string;
  }>;
}

// UI State Types
export type ReportTab = "all" | "staff" | "leave" | "payroll";

export interface ReportFiltersState {
  activeTab: ReportTab;
  departmentId?: string;
  year: number;
  startDate?: string;
  endDate?: string;
}

// Chart Types (for component props)
export interface ChartProps {
  filters?: AnalyticsFilters;
}

export interface ChartData<T = any> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
}

// API Response Types
export type StaffStrengthYearsResponse = StaffStrengthYearData[];
export type StaffCategoryResponse = StaffCategoryData[];
export type StaffDepartmentResponse = StaffDepartmentData[];
export type MonthlyLeaveUsageResponse = MonthlyLeaveData[];
export type PayrollBreakdownResponse = PayrollBreakdownData[];
export type AnalyticsSummaryResponse = AnalyticsSummary;
export type DepartmentPerformanceResponse = DepartmentPerformance[];
export type YearOverYearGrowthResponse = YearOverYearGrowth[];
export type LeaveTypeDistributionResponse = LeaveTypeDistribution[];
export type ExportReportResponse = ExportReportData;
