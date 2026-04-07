export const ADMIN_MODULES = [
  "home",
  "companies",
  "cars",
  "drivers",
  "passengers",
  "routes",
  "salary",
  "settings",
  "admins",
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

export interface PermissionInput {
  module: AdminModule;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CreateAdminInput {
  email: string;
  password?: string;
  role_name: string;
  role_description?: string;
  permissions: PermissionInput[];
}

export interface UpdateAdminInput {
  email?: string;
  password?: string;
  role_name?: string;
  role_description?: string;
  permissions?: PermissionInput[];
  is_active?: boolean;
}

export interface AuthRequestUser {
  id?: string;
  role?: string;
  is_admin_role?: boolean;
  is_super_admin?: boolean;
  [key: string]: unknown;
}

export interface ForgotPasswordOtpRecord {
  otp: string;
  expiresAt: number;
  verified: boolean;
}
