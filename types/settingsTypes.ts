// ========================================
// SETTINGS TYPES
// Add these to your main types.ts file
// ========================================

export type SettingsTab =
  | "ranks"
  | "committees"
  | "preferences"
  | "departments"
  | "appointments"
  | "responsibilities";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type FiscalYearMonth =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export type TSystemPreferences = {
  id: string;
  institutionName: string;
  institutionAbbreviation: string;
  dateFormat: DateFormat;
  fiscalYearStart: FiscalYearMonth;
  leaveApprovalLevels: number;
  emailNotifications: boolean;
  smsNotifications?: boolean;
  theme?: "light" | "dark" | "system";
  language?: string;
  timezone?: string;
  updatedAt: string;
  updatedBy?: string;
};

// Request/Response Types
export type TUpdatePreferencesRequest = {
  institutionName?: string;
  institutionAbbreviation?: string;
  dateFormat?: DateFormat;
  fiscalYearStart?: FiscalYearMonth;
  leaveApprovalLevels?: number;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  theme?: "light" | "dark" | "system";
  language?: string;
  timezone?: string;
};
