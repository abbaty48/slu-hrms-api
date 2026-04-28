import type { UserType } from "@fastify/jwt";

export const AuthUserRole = {
  DEPT_ADMIN: "dept_admin",
  HR_ADMIN: "hr_admin",
  STAFF: "staff",
};

export type TAuthUser = UserType & {
  sId: string;
  sub: string;
  email: string;
  role: (typeof AuthUserRole)[keyof typeof AuthUserRole];
};

export type TAccessToken = TAuthUser & {
  jti: string;
  type: string;
};

export interface IAuthCredentials {
  email: string;
  role: (typeof AuthUserRole)[keyof typeof AuthUserRole];
  password: string;
  rememberMe?: boolean;
}

export interface IAuthResponse {
  user: TAuthUser;
  accessToken: string;
  expiresIn: string | undefined; // milliseconds
}

export interface ILogoutResponse {
  success: boolean;
  message: string;
}

export interface IForgotPasswordRequest {
  email: string;
}

export interface IForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface IResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface IResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface IChangePasswordResponse {
  success: boolean;
  message: string;
}

export interface IVerifyTokenRequest {
  token: string;
}

export interface IVerifyTokenResponse {
  valid: boolean;
  user?: TAuthUser;
}

export interface IPasswordReset {
  userId: string;
  token: string;
  expiresAt: string; // 1 hour
  createdAt: string;
}

export interface IAuthContextType {
  user: TAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: IAuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: TAuthUser) => void;
}

export interface IAuthRefreshResponse {
  accessToken: string;
  expiresIn: string;
}

// Role configuration
export interface IRoleConfig {
  id: (typeof AuthUserRole)[keyof typeof AuthUserRole];
  label: string;
  description: string;
  icon: string;
  permissions: string[];
}

// export const ROLE_CONFIGS: Record<AuthUserRole, IRoleConfig> = {
//   admin: {
//     id: "admin",
//     label: "HR Admin",
//     description: "Full system access",
//     icon: "Shield",
//     permissions: [
//       "manage_staff",
//       "manage_leave",
//       "manage_payroll",
//       "view_reports",
//       "manage_settings",
//       "manage_departments",
//     ],
//   },
//   staff: {
//     id: "staff",
//     label: "Staff",
//     description: "Personal access",
//     icon: "User",
//     permissions: [
//       "view_own_profile",
//       "request_leave",
//       "view_own_payroll",
//       "view_own_attendance",
//     ],
//   },
// };
