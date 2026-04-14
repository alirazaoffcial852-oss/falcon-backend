import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import {
  ADMIN_MODULES,
  type AdminModule,
  type PermissionInput,
  type CreateAdminInput,
  type UpdateAdminInput,
} from "../types/admin/auth";
import bcrypt from "bcryptjs";

export class AdminService {
  private db = DatabaseService.getInstance().getPrisma();

  async createAdmin(
    input: CreateAdminInput,
    createdByUserId: number
  ): Promise<{
    id: number;
    email: string;
    role: string;
    permissions: PermissionInput[];
    generatedPassword?: string;
  }> {
    const { email, password, role_name, role_description, permissions } =
      input;

    const existingUser = await this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingUser) {
      throw ResponseHandler.badRequest("Email already exists");
    }

    let role = await this.db.role.findUnique({
      where: { name: role_name },
    });

    if (!role) {
      role = await this.db.role.create({
        data: {
          name: role_name,
          description: role_description,
          is_admin_role: true,
        },
      });
    }

    if (permissions && permissions.length > 0) {
      await this.db.adminPermission.deleteMany({
        where: { role_id: role.id },
      });

      await Promise.all(
        permissions.map((perm) =>
          this.db.adminPermission.create({
            data: {
              role_id: role.id,
              module: perm.module,
              can_view: perm.can_view,
              can_create: perm.can_create,
              can_edit: perm.can_edit,
              can_delete: perm.can_delete,
            },
          })
        )
      );
    }

    const generatedPassword = password || this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const user = await this.db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role_id: role.id,
        created_by: createdByUserId,
        is_super_admin: false,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions.map((p) => ({
        module: p.module as AdminModule,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      })),
      generatedPassword: password ? undefined : generatedPassword,
    };
  }

  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async getAllAdmins(
    requestingUserId: number
  ): Promise<
    {
      id: number;
      email: string;
      role: string;
      role_description: string | null;
      created_at: Date;
      created_by: number | null;
      is_super_admin: boolean;
      permissions: PermissionInput[];
    }[]
  > {
    const requestingUser = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: { role: true },
    });

    const isSuperAdmin = requestingUser?.is_super_admin ?? false;

    const admins = await this.db.user.findMany({
      where: {
        role: {
          is_admin_role: true,
        },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return admins.map((admin) => ({
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
      role_description: admin.role.description,
      created_at: admin.created_at,
      created_by: admin.created_by,
      is_super_admin: admin.is_super_admin,
      permissions: admin.role.permissions.map((p) => ({
        module: p.module as AdminModule,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      })),
    }));
  }

  async getAdminById(
    adminId: number,
    requestingUserId: number
  ): Promise<{
    id: number;
    email: string;
    role: string;
    role_description: string | null;
    created_at: Date;
    created_by: number | null;
    is_super_admin: boolean;
    permissions: PermissionInput[];
  }> {
    const requestingUser = await this.db.user.findUnique({
      where: { id: requestingUserId },
    });

    const admin = await this.db.user.findFirst({
      where: {
        id: adminId,
        role: {
          is_admin_role: true,
        },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      throw ResponseHandler.notFound("Admin not found");
    }

    if (admin.is_super_admin && !requestingUser?.is_super_admin) {
      throw ResponseHandler.forbidden("Cannot view super admin details");
    }

    return {
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
      role_description: admin.role.description,
      created_at: admin.created_at,
      created_by: admin.created_by,
      is_super_admin: admin.is_super_admin,
      permissions: admin.role.permissions.map((p) => ({
        module: p.module as AdminModule,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      })),
    };
  }

  async updateAdmin(
    adminId: number,
    input: UpdateAdminInput,
    requestingUserId: number
  ): Promise<{
    id: number;
    email: string;
    role: string;
    permissions: PermissionInput[];
  }> {
    const requestingUser = await this.db.user.findUnique({
      where: { id: requestingUserId },
    });

    const admin = await this.db.user.findFirst({
      where: {
        id: adminId,
        role: {
          is_admin_role: true,
        },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      throw ResponseHandler.notFound("Admin not found");
    }

    if (admin.is_super_admin) {
      throw ResponseHandler.forbidden("Cannot modify super admin");
    }

    if (input.role_name || input.role_description) {
      await this.db.role.update({
        where: { id: admin.role_id },
        data: {
          ...(input.role_name && { name: input.role_name }),
          ...(input.role_description && {
            description: input.role_description,
          }),
        },
      });
    }

    if (input.permissions && input.permissions.length > 0) {
      await this.db.adminPermission.deleteMany({
        where: { role_id: admin.role_id },
      });

      await Promise.all(
        input.permissions.map((perm) =>
          this.db.adminPermission.create({
            data: {
              role_id: admin.role_id,
              module: perm.module,
              can_view: perm.can_view,
              can_create: perm.can_create,
              can_edit: perm.can_edit,
              can_delete: perm.can_delete,
            },
          })
        )
      );
    }

    const updateData: {
      email?: string;
      password?: string;
    } = {};

    if (input.email) {
      const existingUser = await this.db.user.findFirst({
        where: {
          email: input.email.toLowerCase().trim(),
          NOT: { id: adminId },
        },
      });
      if (existingUser) {
        throw ResponseHandler.badRequest("Email already in use");
      }
      updateData.email = input.email.toLowerCase().trim();
    }

    if (input.password) {
      updateData.password = await bcrypt.hash(input.password, 10);
    }

    const updatedUser = await this.db.user.update({
      where: { id: adminId },
      data: updateData,
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role.name,
      permissions: updatedUser.role.permissions.map((p) => ({
        module: p.module as AdminModule,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      })),
    };
  }

  async deleteAdmin(
    adminId: number,
    requestingUserId: number
  ): Promise<{ message: string }> {
    const requestingUser = await this.db.user.findUnique({
      where: { id: requestingUserId },
    });

    const admin = await this.db.user.findFirst({
      where: {
        id: adminId,
        role: {
          is_admin_role: true,
        },
      },
    });

    if (!admin) {
      throw ResponseHandler.notFound("Admin not found");
    }

    if (adminId === requestingUserId) {
      throw ResponseHandler.badRequest("Cannot delete yourself");
    }

    if (admin.is_super_admin) {
      throw ResponseHandler.forbidden("Cannot delete super admin");
    }

    await this.db.user.delete({
      where: { id: adminId },
    });

    return { message: "Admin deleted successfully" }; 
  }

  async getUserPermissions(userId: number): Promise<PermissionInput[]> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // Super admin bypass - check before is_admin_role
    if (user.is_super_admin) {
      return ADMIN_MODULES.map((module) => ({
        module,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
      }));
    }

    if (!user.role.is_admin_role) {
      return [];
    }

    return user.role.permissions.map((p) => ({
      module: p.module as AdminModule,
      can_view: p.can_view,
      can_create: p.can_create,
      can_edit: p.can_edit,
      can_delete: p.can_delete,
    }));
  }

  async hasPermission(
    userId: number,
    module: AdminModule,
    action: "view" | "create" | "edit" | "delete"
  ): Promise<boolean> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    // Super admin bypass - check before is_admin_role
    if (user.is_super_admin) {
      return true;
    }

    if (!user.role.is_admin_role) {
      return false;
    }

    const permission = user.role.permissions.find((p) => p.module === module);

    if (!permission) {
      return false;
    }

    switch (action) {
      case "view":
        return permission.can_view;
      case "create":
        return permission.can_create;
      case "edit":
        return permission.can_edit;
      case "delete":
        return permission.can_delete;
      default:
        return false;
    }
  }
}

export const adminService = new AdminService();
