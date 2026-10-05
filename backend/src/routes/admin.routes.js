import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  getAdminMe,
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getReports,
  updateReportStatus,
  getAdmins,
  createAdmin,
  toggleAdminStatus,
} from "../controllers/admin.controller.js";
import { requireAdminAuth } from "../middleware/adminAuth.middleware.js";

const router = Router();

// --- Authentication ---
router.post("/auth/login", adminLogin);
router.post("/auth/logout", requireAdminAuth, adminLogout);
router.get("/auth/me", requireAdminAuth, getAdminMe);

// --- Analytics & Statistics ---
router.get("/stats", requireAdminAuth, getDashboardStats);

// --- User Management ---
router.get("/users", requireAdminAuth, getUsers);
router.get("/users/:id", requireAdminAuth, getUserById);
router.patch("/users/:id", requireAdminAuth, updateUser);
router.delete("/users/:id", requireAdminAuth, deleteUser);

// --- Moderation & Reports ---
router.get("/reports", requireAdminAuth, getReports);
router.patch("/reports/:id", requireAdminAuth, updateReportStatus);

// --- Admin Team Management ---
router.get("/admins", requireAdminAuth, getAdmins);
router.post("/admins", requireAdminAuth, createAdmin);
router.patch("/admins/:id/toggle", requireAdminAuth, toggleAdminStatus);

export default router;
