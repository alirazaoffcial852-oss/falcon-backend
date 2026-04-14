import { Router } from "express";
import { adminController } from "../../controllers/adminController";
import { getSocket } from "../../config/socketService";

const router = Router();

router.get("/socket/status", (req, res) => {
  try {
    const io = getSocket();
    const sockets = io.sockets.sockets;
    const rooms = io.sockets.adapter.rooms;

    res.json({
      status: "ok",
      connectedClients: sockets.size,
      adminDashboardRoom: rooms.get("admin:dashboard")?.size || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Socket.IO not initialized",
      error: (error as Error).message,
    });
  }
});

router.get("/", adminController.getAllAdmins);

router.get("/permissions/me", adminController.getMyPermissions);

router.post("/permissions/check", adminController.checkPermission);

router.post("/", adminController.createAdmin);

router.get("/:id", adminController.getAdminById);

router.put("/:id", adminController.updateAdmin);

router.delete("/:id", adminController.deleteAdmin);

export default router;
