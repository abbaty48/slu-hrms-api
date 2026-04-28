import type { TPagination } from "./types.ts";

export type TDepartmentName = {
  id: string;
  name: string;
};

export type TDepartment = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  staffCount: number;
  description: string | null;
  // headOfDepartment: string | null;
};

export type TDepartmentSummary = {
  departmentId: string;
  staffCount: number;
  seniorStaff: number;
  juniorStaff: number;
  teachingStaff: number;
  departmentName: string;
  nonTeachingStaff: number;
};

export type TDepartmentCreateRequest = {
  name: string;
  code: string;
  isActive: boolean;
  headId: string | null;
  description: string | null;
};

export type TDepartmentUpdateRequest = {
  name: string | null;
  code: string | null;
  headId: string | null;
  isActive: boolean | null;
  description: string | null;
};

export type TDepartmentsList = {
  data: TDepartment[];
  pagination: TPagination | null;
};

export type TDepartmentNameList = TDepartmentName[];
