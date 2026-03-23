export type TUserRole = "admin" | "staff";
// Entity Interfaces
export interface TUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: TUserRole;
  staffId: string | null;
  passwordHash: string;
  departmentId: string | null;
  profilePhoto: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
