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
  departmentId?: string;
  profilePhoto?: string;
  phoneNumber?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}
