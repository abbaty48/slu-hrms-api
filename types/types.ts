import type {
  TNotification,
  TNotificationPreferences,
} from "./notificationsTypes.ts";
import type { TLeaveRequest, TLeaveType } from "./leave-managementTypes.ts";
import type { TNatureOfAppointment } from "./appointmentTypes.ts";
import type { TResponsibility } from "./responsibilityTypes.ts";
import type { TSystemPreferences } from "./settingsTypes.ts";
import type { TAttendance } from "./attendance.types.ts";
import type { TDepartment } from "./departmentTypes.ts";
import type { TCommittee } from "./committeeTypes.ts";
import type { IPasswordReset } from "./authTypes.ts";
import type { TStaff } from "./staffTypes.ts";
import type { TUser } from "./userTypes.ts";
import type { TRank } from "./rankTypes.ts";
import type { TQualification } from "./qualificationTypes.ts";

export type TDocument = {
  id: string;
  staffId: string;
  staffName?: string; // added by server when fetching
  title: string;
  category: string;
  fileName: string;
  fileSize: number; // raw bytes in db — server formats it to "1.2 MB" in responses
  mimeType: string;
  uploadedBy: string;
  isVerified: boolean;
  verifiedBy: string | null;
  description: string | null;
  degree: string | null;
  institution: string | null;
  year: string | null;
  createdAt: string;
  updatedAt: string;
};

// what the server sends back in responses (formatted for display)
export type TDocumentResponse = {
  id: string;
  staffId: string;
  staffName?: string;
  title: string;
  category: string;
  fileType: string; // "PDF" | "JPG" | "PNG"
  fileSize: string; // formatted — "1.2 MB" | "890 KB"
  mimeType?: string;
  status: "Verified" | "Pending";
  uploadedAt: string;
  description: string | null;
  degree: string | null;
  institution: string | null;
  year: string | null;
};

export type TDocumentSummary = {
  totalDocuments: number;
  verifiedDocuments: number;
  pendingDocuments: number;
  categoryDistribution: Record<string, number>;
};

export type TAllDocumentsResponse = {
  documents: TDocumentResponse[];
  total: number;
  page: number;
  limit: number;
};

export type TStaffDocumentsResponse = {
  summary: TDocumentSummary | null;
  data: TDocumentResponse[];
};

export type TAddDocumentPayload = {
  title: string;
  category: string;
  fileName: string;
  fileSize?: number;
  mimeType: string;
  description?: string;
  degree?: string;
  institution?: string;
  year?: string;
};

export type TPayroll = {
  id: string;
  staffId: string;
  month: number;
  year: number;
  basicSalary: number;
  totalAllowances: number;
  paymentDate: string | null;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  totalDeductions: number;
  grossSalary: number;
  netSalary: number;
  status: string;
  processedBy: string | null;
  processedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// export type TDocument = {
//   id: string;
//   staffId: string;
//   documentType: string;
//   fileName: string;
//   fileUrl: string;
//   uploadedBy: string;
//   uploadedAt: string;
//   expiryDate: string | null;
//   createdAt: string;
//   updatedAt: string;
// };

export type TAnnouncement = {
  id: string;
  title: string;
  content: string;
  priority: string;
  publishedBy: string;
  publishedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

// Database Interface
export type TDatabase = {
  users: TUser[];
  ranks: TRank[];
  staff: TStaff[];
  payrolls: TPayroll[];
  documents: TDocument[];
  leaves: TLeaveRequest[];
  committees: TCommittee[];
  leaveTypes: TLeaveType[];
  attendance: TAttendance[];
  departments: TDepartment[];
  notifications: TNotification[];
  announcements: TAnnouncement[];
  passwordResets: IPasswordReset[];
  qualifications: TQualification[];
  responsibilities: TResponsibility[];
  systemPreferences: TSystemPreferences;
  employmentHistory: TEmploymentHistory[];
  natureOfAppointments: TNatureOfAppointment[];
  notificationPreferences: TNotificationPreferences[];
  EmploymentHistoryResponse: TEmploymentHistoryResponse[];
};

// Request Interfaces
export type TAuthRequest = Request & {
  user?: {
    id: string;
    email: string;
    role: string;
    staffId: string;
  };
};

// Response DTOs
export type TDashboardStats = {
  totalStaff: number;
  avgWorkHours: number;
  onLeaveChange: number;
  attendanceRate: string;
  todayAttendance: number;
  totalStaffChange: number;
  totalActiveStaff: number;
  activeStaffChange: number;
  totalLateArrivals: number;
  totalDepartments: number;
  totalOnLeaveStaff: number;
  totalTeachingStaff: number;
  totalPendingLeaves: number;
  avgWorkHoursChange: number;
  attendanceRateChange: number;
  totalPresentLateToday: number;
  totalNonTeachingStaff: number;
};

export type TEmploymentHistoryResponse = {
  data: TEmploymentHistory[];
  nextPage: number | null;
};

// Auth DTOs
export type TLoginRequest = {
  email: string;
  password: string;
};

export type TLoginResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    staff?: TStaff;
  };
};

export type TRegisterRequest = {
  email: string;
  password: string;
  staffId?: string;
};

export type TRegisterResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
};

export type TPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
};
