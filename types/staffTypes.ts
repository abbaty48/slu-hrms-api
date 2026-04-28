import type { TUser } from "./userTypes.ts";
import type { TRank } from "./rankTypes.ts";
import type { TPagination } from "./types.ts";
import type { TDepartment } from "./departmentTypes.ts";
import type { TLeave } from "./leave-managementTypes.ts";

export type TStaffWithDepartmentName = TStaff & {
  department: { name: string };
};
export type TStaffCategory = "Senior" | "Junior";
export type TGender = "Male" | "Female" | "Others";

export type TStaffStatus =
  | "Employed"
  | "OnLeave"
  | "Retired"
  | "Terminated"
  | "Resigned"
  | "Deceased"
  | "Suspended"
  | "Contract_Ended";

export type TCadre =
  | "Teaching"
  | "Technical"
  | "Non-Teaching"
  | "Administrative";

export interface TStaff {
  id: string;
  title: string | null;
  staffNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: Date | null;
  placeOfBirth: string | null;
  gender: TGender | null;
  address: string | null;
  city: string | null;
  state: string | null;
  lga: string | null;
  town: string | null;
  departmentId: string | null;
  department: {
    name: string;
  } | null;
  rankId: string;
  rank: string;
  cadre: TCadre;
  staffCategory: TStaffCategory;
  maritalStatus: string | null;
  religion: string | null;
  nationality: string | null;
  profilePhoto: string | null;
  natureOfAppointment: string | null;
  conuassContiss: string | null;
  dateOfFirstAppointment: Date | null;
  dateOfLastPromotion: Date | null;
  status: TStaffStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TChartStaffPerDepartment = {
  departmentName: string;
  staffCount: number;
  teachingStaff: number;
  nonTeachingStaff: number;
};

export type TStaffIdentity = {
  id: string;
  firstName: string;
  lastName: string;
  rank: string;
  department: string;
};

export type TStaffDetails = TStaff & {
  department: TDepartment | null;
  rankDetails: TRank | null;
  user: TUser | null;
};

export type TStaffList = {
  data: TStaff[];
  pagination: TPagination;
};

export type TEnrichedStaff = TStaff & {
  department?: TDepartment;
  rankDetails?: TRank;
};

// Statistics DTOs
export type TStaffStatistics = {
  byDepartment: {
    departmentName: string;
    count: number;
  }[];
  byRank: {
    rank: string;
    count: number;
  }[];
  byCadre: {
    cadre: string;
    count: number;
  }[];
  byState: {
    state: string;
    count: number;
  }[];
  byStatus: {
    status: string;
    count: number;
  }[];
};

/* STAFF FORM DATA */
export type TStaffFormData = {
  // Personal Details
  personalStaffNumber: string; //staffNo
  personalTitle: string; //title
  personalFirstName: string; //firstName
  personalLastName: string; //lastName
  personalStaffCategory: string; //staffCategory
  personalGender: string; //gender
  personalMaritalStatus: string; //maritalStatus
  personalDateOfBirth: string; //dateOfBirth
  personalPhone: string; //phone
  personalEmail: string; //email
  personalPlaceOfBirth: string; //address
  personalReligion: string; //religion

  // Appointment Details
  appointmentCadre: string; //cadre
  appointmentRank: string; //rank
  appointmentLevel: string; //staffCategory
  appointmentNature: string; //natureOfAppointment
  appointmentDateFirst: string; //dateOfFirstAppointment
  appointmentDatePresent: string; // dateOfLastPromotion
  appointmentUnitDepartment: string; //departmentId

  // Location Details
  locationTown: string; //
  locationCity: string; //
  locationState: string; //state
  locationNationality: string; //nationality
  locationStaffStatus: string; //status
  locationLocalGovernment: string; //lga
  locationStaffStatusComment?: string; //
  locationPermanentAddress: string; //
};

export type TStaffStats = {
  staffId: string;
  name: string;
  department: string | null;
  rank: string;
  leaveBalances: {
    totalAllowed: number;
    totalUsed: number;
    totalRemaining: number;
    breakdown: {
      leaveTypeId: string;
      name: string;
      used: number;
      allowed: number;
      remaining: number;
      paidLeave: boolean;
      carryForward: boolean;
    }[];
  };
  attendance: {
    totalDays: number;
    present: number;
    absent: number;
    late: number;
    rate: string;
    onLeave: number;
    workHours: number;
  };
  leavePercent: number;
  // salary: {
  //   netSalary: number;
  //   month: number;
  //   status: string;
  // };
  recentLeaves: TLeave[];
};

export type TStaffProfileUpdateRequest = {
  name: string;
  email: string;
  rankId: string;
  joinOn: string;
  departmentId: string;
  phone: string | null;
};

export interface TStaffUpdateStatusRequest {
  staffId: string;
  status: TStaffStatus;
}

export interface TStaffUpdateStatusResponse {
  success: boolean;
  message: string;
  staff: TStaffDetails;
}

export type TStaffEmploymentList = {
  data: {
    id: string;
    staffId: string;
    position: string;
    department: string;
    subject: string | null;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: TPagination;
};

// Helper function to get initials
