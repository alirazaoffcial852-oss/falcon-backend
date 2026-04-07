import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { adminService } from "../services/adminService";
import type { CreateAdminInput, UpdateAdminInput } from "../types/admin/auth";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import { sendCredentialEmail } from "../utils/email";

export class AdminController {
  async createAdmin(req: AuthRequest, res: Response) {
    try {
      const requestingUserId = Number(req.user?.id);
      
      if (!requestingUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const input: CreateAdminInput = req.body;
      
      if (!input.email || !input.role_name) {
        return res.status(400).json({ 
          message: "Email and role_name are required" 
        });
      }

      if (!input.permissions || !Array.isArray(input.permissions)) {
        return res.status(400).json({ 
          message: "Permissions array is required" 
        });
      }

      const admin = await adminService.createAdmin(input, requestingUserId);
      
      // Send credential email if password was auto-generated
      if (admin.generatedPassword) {
        try {
          await sendCredentialEmail(admin.email, "admin", admin.generatedPassword);
        } catch (emailError) {
          console.error("Failed to send credential email:", emailError);
          // Don't fail the request if email fails, just log it
        }
      }
      
      return res.status(201).json({
        message: "Admin created successfully. Credentials sent to email.",
        data: admin,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getAllAdmins(req: AuthRequest, res: Response) {
    try {
      const requestingUserId = Number(req.user?.id);
      
      if (!requestingUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const admins = await adminService.getAllAdmins(requestingUserId);
      
      return res.status(200).json({
        message: "Admins retrieved successfully",
        data: admins,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getAdminById(req: AuthRequest, res: Response) {
    try {
      const requestingUserId = Number(req.user?.id);
      const adminId = Number(req.params.id);
      
      if (!requestingUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!adminId || isNaN(adminId)) {
        return res.status(400).json({ message: "Invalid admin ID" });
      }

      const admin = await adminService.getAdminById(adminId, requestingUserId);
      
      return res.status(200).json({
        message: "Admin retrieved successfully",
        data: admin,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async updateAdmin(req: AuthRequest, res: Response) {
    try {
      const requestingUserId = Number(req.user?.id);
      const adminId = Number(req.params.id);
      
      if (!requestingUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!adminId || isNaN(adminId)) {
        return res.status(400).json({ message: "Invalid admin ID" });
      }

      const input: UpdateAdminInput = req.body;
      
      if (input.permissions && !Array.isArray(input.permissions)) {
        return res.status(400).json({ 
          message: "Permissions must be an array" 
        });
      }

      const admin = await adminService.updateAdmin(adminId, input, requestingUserId);
      
      return res.status(200).json({
        message: "Admin updated successfully",
        data: admin,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async deleteAdmin(req: AuthRequest, res: Response) {
    try {
      const requestingUserId = Number(req.user?.id);
      const adminId = Number(req.params.id);
      
      if (!requestingUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!adminId || isNaN(adminId)) {
        return res.status(400).json({ message: "Invalid admin ID" });
      }

      const result = await adminService.deleteAdmin(adminId, requestingUserId);
      
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getMyPermissions(req: AuthRequest, res: Response) {
    try {
      const userId = Number(req.user?.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const permissions = await adminService.getUserPermissions(userId);
      
      return res.status(200).json({
        message: "Permissions retrieved successfully",
        data: permissions,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async checkPermission(req: AuthRequest, res: Response) {
    try {
      const userId = Number(req.user?.id);
      const { module, action } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!module || !action) {
        return res.status(400).json({ 
          message: "Module and action are required" 
        });
      }

      const hasPermission = await adminService.hasPermission(
        userId,
        module,
        action
      );
      
      return res.status(200).json({
        hasPermission,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export const adminController = new AdminController();
