import type { TPagination } from "./types.ts";

export type TStaffOnStudyLeave = {
  institution: string;
  programme: string;
  sponsorshipType:
    | "Self"
    | "StateGovernment"
    | "UniversityBase"
    | "TedFund"
    | "Others";
  country: string;
  staff: {
    firstName: string;
    lastName: string;
    faculty: string;
    department: string;
  };
};

export type TStaffOnStudyLeaveList = {
  data: TStaffOnStudyLeave[];
  pagination: TPagination | null;
};

export type TChartAccademicSponsorshipDistribution = {
  label: string;
  color: string;
  value: number;
  percent: number;
}[];

export type TChartAccademicStudyLeaveByFaculty = {
  label: string;
  value: number;
}[];

// study by faculty
export type TStudyLeaveByFaculty = {
  faculty: string;
  studyCount: number;
}[];

export type TExtensionRequest = {
  staff: {
    firstName: string;
    lastName: string;
    faculty: string;
    department: string;
  };
  reason: string;
  durationMonths: number;
  extension: "First" | "Second" | "Final";
  status: "Pending" | "Approved" | "Rejected";
  duration: {
    startDate: Date;
    endDate: Date;
  };
  createdAt: Date;
};

export type TExtensionRequestList = {
  data: TExtensionRequest[];
  pagination: TPagination | null;
};
