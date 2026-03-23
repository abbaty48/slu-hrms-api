import type { TPagination } from "./types.ts";

export type TDepartment = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  staffCount: number | 0;
  description: string | null;
  headOfDepartment: string | null;
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
  description?: string;
  headOfDepartment?: string;
};

export type TDepartmentUpdateRequest = {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
  headOfDepartment?: string;
};

export interface TDepartmentsListResponse {
  data: TDepartment[];
  pagination: TPagination;
}
